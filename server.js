import { installSchoolServices } from "./school-services-routes.js";
import { installSchoolRoutes } from "./school-routes.js";

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import argon2 from "argon2";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv
} from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ==================================================
// 1. ENVIRONMENT AND SECURITY CONFIGURATION
// ==================================================

const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "TOTP_ENCRYPTION_KEY"
];

for (const name of required) {
  if (
    !process.env[name] ||
    process.env[name].startsWith("REPLACE_WITH") ||
    process.env[name].includes("YOUR_DATABASE_PASSWORD")
  ) {
    throw new Error(`Configure ${name} in .env`);
  }
}

if (
  process.env.SESSION_SECRET.length < 32 ||
  !/^[0-9a-f]{64}$/i.test(process.env.TOTP_ENCRYPTION_KEY)
) {
  throw new Error("Invalid security secrets in .env");
}

const key = Buffer.from(
  process.env.TOTP_ENCRYPTION_KEY,
  "hex"
);

// ==================================================
// 2. POSTGRESQL CONNECTION
// ==================================================

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,

  // Avoid waiting indefinitely for a connection.
  connectionTimeoutMillis: 5000,

  // Limit long-running database statements.
  statement_timeout: 10000,

  // Protect against abandoned transactions.
  idle_in_transaction_session_timeout: 10000
});

pool.on("error", error => {
  console.error(
    "[DATABASE] Idle connection error:",
    error.message
  );
});

// ==================================================
// 3. EXPRESS APPLICATION
// ==================================================

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "16kb" }));

// ==================================================
// 4. POSTGRESQL SESSION STORAGE
// ==================================================

const PgStore = connectPgSimple(session);

app.use(session({
  store: new PgStore({
    pool,
    createTableIfMissing: true
  }),

  name: "sim.sid",
  secret: process.env.SESSION_SECRET,

  resave: false,
  saveUninitialized: false,
  rolling: true,

  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000
  }
}));

// ==================================================
// 5. SAME-ORIGIN API PROTECTION
// ==================================================

// The simulator is reached from several addresses: the published tunnel
// URL, the tailnet IP and localhost. Pinning the check to PUBLIC_ORIGIN
// alone made every login succeed in the browser's eyes but fail with a
// 403 whenever the page was opened from any address other than that one
// exact string, because only GETs skip this guard. Accept the published
// host *and* the host the browser actually addressed. A cross-site
// attacker's Origin never matches the Host the victim requested, so the
// CSRF guarantee is unchanged; only the scheme is not compared, which is
// what lets the same host work over both http and https.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const origin = req.get("origin");

  const allowedHosts = new Set();

  for (const candidate of [
    req.get("host"),
    process.env.PUBLIC_ORIGIN
  ]) {
    if (!candidate) {
      continue;
    }

    try {
      allowedHosts.add(
        new URL(
          candidate.includes("://")
            ? candidate
            : `http://${candidate}`
        ).host
      );
    } catch {
      /* ignore a malformed PUBLIC_ORIGIN */
    }
  }

  let originHost = null;

  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }

  if (!originHost || !allowedHosts.has(originHost)) {
    return res.status(403).json({
      error: "Invalid request origin"
    });
  }

  next();
});

// ==================================================
// 6. AUTHENTICATION RATE LIMITING
// ==================================================

app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

// ==================================================
// 7. GENERAL HELPERS
// ==================================================

function fail(res, error) {
  console.error("[SERVER ERROR]", error);

  if (res.headersSent) {
    return;
  }

  return res.status(500).json({
    error: "Server error"
  });
}

function validApp(value) {
  return ["bank", "acadia"].includes(value);
}

function validUsername(value) {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9._-]{3,40}$/.test(value)
  );
}

// ==================================================
// 8. MFA SECRET ENCRYPTION
// ==================================================

function encrypt(value) {
  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);

  return Buffer.concat([
    iv,
    cipher.getAuthTag(),
    encrypted
  ]).toString("base64");
}

function decrypt(value) {
  const data = Buffer.from(value, "base64");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    data.subarray(0, 12)
  );

  decipher.setAuthTag(
    data.subarray(12, 28)
  );

  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final()
  ]).toString("utf8");
}

// ==================================================
// 10. POSTGRESQL SECURITY EVENT LOGGING
// ==================================================

async function logEventInBackground(userId, which, type, detail) {
  try {
    await pool.query(
      `INSERT INTO security_events (user_id, app, event_type, detail)
       VALUES ($1,$2,$3,$4)`,
      [userId || null, which || null, type, detail]
    );
  } catch (error) {
    console.error("[SECURITY] Logging error:", error.message);
  }
}

// ==================================================
// 11. REQUIRE AUTHENTICATED APPLICATION
// ==================================================

function requireApp(which) {
  return (req, res, next) => {
    if (
      !req.session.mfa ||
      req.session.app !== which ||
      !req.session.userId
    ) {
      logEventInBackground(
        req.session.userId,
        which,
        "access_denied",
        "Protected endpoint rejected request"
      );

      return res.status(401).json({
        error: "Authentication required"
      });
    }

    next();
  };
}


function requireAcadiaRole(role) {
  return (req, res, next) => {
    if (
      !req.session.mfa ||
      !req.session.userId ||
      req.session.app !== "acadia"
    ) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    if (req.session.role !== role) {
      return res.status(403).json({
        error: "Access denied for this account role"
      });
    }

    next();
  };
}


// ==================================================
// 12. SESSION HELPERS
// ==================================================

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function regenerate(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ==================================================
// 13. ACCOUNT REGISTRATION
// ==================================================

app.post("/api/auth/register", async (req, res) => {
  const {
    app: which,
    username,
    password
  } = req.body || {};

  if (
    !validApp(which) ||
    !validUsername(username) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error:
        "Valid username and 12-128 character password required"
    });
  }

  let client;

  try {
    console.log("[REGISTER] Hashing password");

    const hash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    client = await pool.connect();

    await client.query("BEGIN");

    
// Assign the correct role when creating an account.
// Public registration can create students and bank users,
// but never administrators.

const accountRole =
  which === "bank" ? "bank_user" : "student";

const result = await client.query(
  `INSERT INTO users
   (app, username, password_hash, role)
   VALUES ($1, $2, $3, $4)
   RETURNING id`,
  [
    which,
    username.toLowerCase(),
    hash,
    accountRole
  ]
);


    const id = result.rows[0].id;

    if (which === "bank") {
      await client.query(
        `INSERT INTO bank_accounts
         (user_id, kind, balance_cents)
         VALUES
         ($1,'chequing',100000),
         ($1,'savings',250000)`,
        [id]
      );
    } else {
      await client.query(
        `INSERT INTO student_profiles
         (
           user_id,
           display_name,
           program,
           year_of_study,
           tuition_cents
         )
         VALUES ($1,$2,$3,4,125000)`,
        [
          id,
          username,
          "Bachelor of Computer Science"
        ]
      );

    }

    await client.query("COMMIT");

    // Release the transaction connection before logging.
    client.release();
    client = null;

    logEventInBackground(
      id,
      which,
      "registration",
      "New simulator account registered"
    );

    return res.status(201).json({
      message: "Account created. Please sign in."
    });

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Username already exists"
      });
    }

    return fail(res, error);

  } finally {
    if (client) {
      client.release();
    }
  }
});

// ==================================================
// 14. PASSWORD LOGIN
// ==================================================

app.post("/api/auth/login", async (req, res) => {
  const {
  app: which,
  username,
  password,
  role
} = req.body || {};
  if (
    !validApp(which) ||
    !validUsername(username) ||
    typeof password !== "string"
  ) {
    return res.status(401).json({
      error: "Invalid credentials"
    });
  }

  try {
    console.log("[LOGIN] Starting database lookup");

    // Search only within the selected application.
    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE username = $1
         AND app = $2`,
      [
        username.toLowerCase(),
        which
      ]
    );

    console.log("[LOGIN] Database lookup completed");

    const user = result.rows[0];

    
// The requested Acadia role must match
// the role stored in PostgreSQL.
const expectedRole = which === "bank"
  ? "bank_user"
  : role;

if (
  !["student", "admin", "bank_user"].includes(expectedRole) ||
  (which === "acadia" &&
    !["student", "admin"].includes(expectedRole))
) {
  return res.status(401).json({
    error: "Invalid credentials"
  });
}

// A mismatched role is treated as an invalid login.
// Keep the normal password verification below.
const roleMatches = !!user &&
  user.role === expectedRole;


    // Check temporary account lock.
    if (
      user?.locked_until &&
      new Date(user.locked_until) > new Date()
    ) {
      return res.status(429).json({
        error: "Account temporarily locked"
      });
    }

    let valid = false;

    if (user) {
      console.log(
        "[LOGIN] Starting password verification"
      );

      valid = await argon2.verify(
        user.password_hash,
        password
      );

      console.log(
        "[LOGIN] Password verification completed"
      );
    }

    // --------------------------------------------
    // Incorrect username or password
    // --------------------------------------------

    if (!user || !valid || !roleMatches) {
      if (user) {
        await pool.query(
          `UPDATE users
           SET failed_attempts =
             CASE
               WHEN failed_attempts >= 2
               THEN 0
               ELSE failed_attempts + 1
             END,
           locked_until =
             CASE
               WHEN failed_attempts >= 2
               THEN now() + interval '30 seconds'
               ELSE NULL
             END
           WHERE id=$1`,
          [user.id]
        );

        logEventInBackground(
          user.id,
          which,
          "login_failed",
          "Incorrect password"
        );
      }

      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    // --------------------------------------------
    // Password accepted
    // --------------------------------------------

    console.log("[LOGIN] Resetting failed attempts");

    await pool.query(
      `UPDATE users
       SET failed_attempts=0,
           locked_until=NULL
       WHERE id=$1`,
      [user.id]
    );

    console.log("[LOGIN] Regenerating session");

    await regenerate(req);

    console.log("[LOGIN] Session regenerated");

    // The user must still complete MFA.
    req.session.pendingId = String(user.id);
    req.session.pendingApp = which;
    req.session.pendingUntil = Date.now() + 300000;
    req.session.mfaFailures = 0;

    console.log("[LOGIN] Saving session");

    await saveSession(req);

    console.log("[LOGIN] Session saved");

    // Return the MFA step before recording the event.
    res.json({
      next: user.totp_enabled ? "verify" : "enroll"
    });

    // Keep security monitoring active.
    logEventInBackground(
      user.id,
      which,
      "password_verified",
      "Password verified; MFA required"
    );

  } catch (error) {
    fail(res, error);
  }
});

// ==================================================
// 15. REQUIRE PENDING MFA SESSION
// ==================================================

async function requirePending(req, res, next) {
  if (
    !req.session.pendingId ||
    Date.now() > req.session.pendingUntil
  ) {
    return res.status(401).json({
      error: "Sign in again"
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE id=$1 AND app=$2`,
      [
        req.session.pendingId,
        req.session.pendingApp
      ]
    );

    if (!result.rows[0]) {
      return res.status(401).json({
        error: "Account not found"
      });
    }

    req.pendingUser = result.rows[0];
    next();

  } catch (error) {
    fail(res, error);
  }
}

// ==================================================
// 16. AUTHENTICATOR ENROLLMENT
// ==================================================

app.post(
  "/api/auth/enroll",
  requirePending,
  async (req, res) => {
    if (req.pendingUser.totp_enabled) {
      return res.status(409).json({
        error: "Authenticator already configured"
      });
    }

    const secret = speakeasy.generateSecret({
      name:
        `Smartphone Simulator ${req.pendingUser.app}`,
      issuer: "Smartphone Simulator",
      length: 20
    });

    req.session.enrollmentSecret = secret.base32;

    try {
      await saveSession(req);

      return res.json({
        qr: await QRCode.toDataURL(
          secret.otpauth_url
        ),
        manualKey: secret.base32
      });

    } catch (error) {
      fail(res, error);
    }
  }
);

// ==================================================
// 17. AUTHENTICATOR VERIFICATION
// ==================================================

app.post(
  "/api/auth/verify",
  requirePending,
  async (req, res) => {
    const code = req.body?.code;

    if (
      typeof code !== "string" ||
      !/^[0-9]{6}$/.test(code)
    ) {
      return res.status(400).json({
        error: "Enter a six-digit code"
      });
    }

    const user = req.pendingUser;

    try {
      const secret = user.totp_enabled
        ? decrypt(user.totp_secret)
        : req.session.enrollmentSecret;

      if (!secret) {
        return res.status(400).json({
          error: "Start authenticator setup first"
        });
      }

      const delta = speakeasy.totp.verifyDelta({
        secret,
        encoding: "base32",
        token: code,
        window: 1
      });

      const timeStep =
        Math.floor(Date.now() / 30000) +
        (delta?.delta ?? 0);

      // A null result means the TOTP is invalid.
      const accepted =
        delta != null &&
        timeStep > Number(user.last_totp_step);

      // --------------------------------------------
      // Incorrect MFA code
      // --------------------------------------------

      if (!accepted) {
        req.session.mfaFailures =
          (req.session.mfaFailures || 0) + 1;

        logEventInBackground(
          user.id,
          user.app,
          "mfa_failed",
          "Incorrect, expired, or reused TOTP"
        );

        if (req.session.mfaFailures >= 3) {
          await pool.query(
            `UPDATE users
             SET locked_until =
               now() + interval '30 seconds'
             WHERE id=$1`,
            [user.id]
          );

          await regenerate(req);

          return res.status(429).json({
            error:
              "Too many attempts. Sign in again later."
          });
        }

        await saveSession(req);

        return res.status(401).json({
          error:
            "Invalid, expired, or already used code"
        });
      }

      // --------------------------------------------
      // Correct MFA code
      // --------------------------------------------

      const updated = await pool.query(
        `UPDATE users
         SET last_totp_step=$1,
             totp_secret=CASE
               WHEN totp_enabled
               THEN totp_secret
               ELSE $2
             END,
             totp_enabled=TRUE
         WHERE id=$3
           AND last_totp_step<$1
         RETURNING id`,
        [
          timeStep,
          encrypt(secret),
          user.id
        ]
      );

      if (!updated.rowCount) {
        return res.status(401).json({
          error: "Code already used"
        });
      }

      await regenerate(req);

      req.session.userId = String(user.id);
      req.session.app = user.app;
      req.session.role = user.role;
      req.session.mfa = true;

      await saveSession(req);

      // Respond before recording the event.
      res.json({
  message: "Authenticated",
  app: user.app,
  role: user.role
});

      logEventInBackground(
        user.id,
        user.app,
        "login_success",
        "Password and authenticator verified"
      );

    } catch (error) {
      fail(res, error);
    }
  }
);

// ==================================================
// 18. SESSION MANAGEMENT
// ==================================================


app.get("/api/auth/me", (req, res) => {
  res.json({
    authenticated: !!req.session.mfa,
    app: req.session.app || null,
    role: req.session.mfa
      ? req.session.role || null
      : null
  });
});


app.post("/api/auth/logout", (req, res) => {
  const userId = req.session.userId;
  const which = req.session.app;

  req.session.destroy(error => {
    if (error) {
      return fail(res, error);
    }

    res.clearCookie("sim.sid");

    res.json({
      message: "Signed out"
    });

    logEventInBackground(
      userId,
      which,
      "logout",
      "User signed out"
    );
  });
});

// ==================================================
// 19. BANKING ACCOUNTS
// ==================================================

app.get(
  "/api/bank/accounts",
  requireApp("bank"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT user_id,kind,balance_cents
         FROM bank_accounts
         WHERE user_id=$1
         ORDER BY kind`,
        [req.session.userId]
      );

      res.json({
        accounts: result.rows
      });

    } catch (error) {
      fail(res, error);
    }
  }
);


// SIMULATED BANK LINKING: issue a short-lived one-time proof after Banking login.
// Do not reveal account numbers or codes to unauthenticated callers.
app.post('/api/bank/link-code', requireApp('bank'), async(req,res)=>{
  try{
    const {randomBytes,createHash}=await import('node:crypto');
    const a=await pool.query("SELECT id FROM bank_accounts WHERE user_id=$1 AND kind='chequing'",[req.session.userId]);
    if(!a.rowCount)return res.status(404).json({error:'No chequing account found'});
    const code=randomBytes(12).toString('hex').toUpperCase();
    const hash=createHash('sha256').update(code).digest('hex');
    await pool.query("DELETE FROM sim_bank_link_codes WHERE bank_account_id=$1",[a.rows[0].id]);
    await pool.query("INSERT INTO sim_bank_link_codes(bank_account_id,code_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[a.rows[0].id,hash]);
    res.json({account_number:'SIM'+String(a.rows[0].id).padStart(10,'0'),verification_code:code,expires_in_minutes:10});
  }catch(e){fail(res,e)}
});
app.get('/api/bank/account-details',requireApp('bank'),async(req,res)=>{
  try{
    const q=await pool.query("SELECT id,user_id,kind FROM bank_accounts WHERE user_id=$1 ORDER BY kind",[req.session.userId]);
    res.json({accounts:q.rows.map(a=>({user_id:a.user_id,kind:a.kind,account_number:'SIM'+String(a.id).padStart(10,'0')}))});
  }catch(e){fail(res,e)}
});

// ==================================================
// 20. BANKING TRANSFER HISTORY
// ==================================================

app.get(
  "/api/bank/transfers",
  requireApp("bank"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           user_id,
           from_kind,
           to_kind,
           amount_cents,
           created_at
         FROM bank_transfers
         WHERE user_id=$1
         ORDER BY id DESC
         LIMIT 30`,
        [req.session.userId]
      );

      res.json({
        transfers: result.rows
      });

    } catch (error) {
      fail(res, error);
    }
  }
);

// Simulated university scholarship credits received by this Banking user.
app.get('/api/bank/scholarship-credits',requireApp('bank'),async(req,res)=>{
 try{const q=await pool.query(`SELECT a.description,a.bank_cents AS amount_cents,a.created_at FROM school_financial_adjustments a JOIN users u ON u.app='bank' AND u.username=a.bank_username WHERE u.id=$1 AND a.bank_cents>0 ORDER BY a.id DESC LIMIT 50`,[req.session.userId]);res.json({credits:q.rows})}catch(e){fail(res,e)}
});

// ==================================================
// 21. BANKING TRANSFER
// ==================================================

app.post(
  "/api/bank/transfer",
  requireApp("bank"),
  async (req, res) => {
    const {
      from,
      to,
      amountCents,
      requestId
    } = req.body || {};

    if (
      !["chequing", "savings"].includes(from) ||
      !["chequing", "savings"].includes(to) ||
      from === to ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 1 ||
      amountCents > 100000000 ||
      typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)
    ) {
      return res.status(400).json({
        error: "Invalid transfer"
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      // Serialize transfers for this user.
      await client.query(
        `SELECT id
         FROM users
         WHERE id=$1
         FOR UPDATE`,
        [req.session.userId]
      );

      // Detect duplicate requests.
      const previous = await client.query(
        `SELECT id
         FROM bank_transfers
         WHERE user_id=$1
           AND request_id=$2`,
        [
          req.session.userId,
          requestId
        ]
      );

      if (previous.rowCount) {
        await client.query("COMMIT");

        client.release();
        client = null;

        res.json({
          message: "Request already processed"
        });

        logEventInBackground(
          req.session.userId,
          "bank",
          "replay_detected",
          "Duplicate transfer request"
        );

        return;
      }

      // Lock both account balances.
      const accounts = await client.query(
        `SELECT id,kind,balance_cents
         FROM bank_accounts
         WHERE user_id=$1
         ORDER BY id
         FOR UPDATE`,
        [req.session.userId]
      );

      const source = accounts.rows.find(
        account => account.kind === from
      );

      const destination = accounts.rows.find(
        account => account.kind === to
      );

      if (!source || !destination) {
        throw new Error("Account missing");
      }

      if (
        BigInt(source.balance_cents) <
        BigInt(amountCents)
      ) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error: "Insufficient fictional funds"
        });
      }

      await client.query(
        `UPDATE bank_accounts
         SET balance_cents=balance_cents-$1
         WHERE id=$2`,
        [
          amountCents,
          source.id
        ]
      );

      await client.query(
        `UPDATE bank_accounts
         SET balance_cents=balance_cents+$1
         WHERE id=$2`,
        [
          amountCents,
          destination.id
        ]
      );

      await client.query(
        `INSERT INTO bank_transfers
         (
           user_id,
           from_kind,
           to_kind,
           amount_cents,
           request_id
         )
         VALUES ($1,$2,$3,$4,$5)`,
        [
          req.session.userId,
          from,
          to,
          amountCents,
          requestId
        ]
      );

      await client.query("COMMIT");

      // Release the transaction before recording the event.
      client.release();
      client = null;

      void logEventInBackground(
        req.session.userId,
        "bank",
        "transfer",
        "Authorized fictional transfer"
      );

      res.json({
        message: "Transfer successful"
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      fail(res, error);

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ==================================================
// BANKING: SAVED RECIPIENTS AND PERSON-TO-PERSON PAYMENTS
// All money is fictional. Routes require an MFA-authenticated bank session.
// ==================================================
app.get('/api/bank/recipients', requireApp('bank'), async (req,res) => {
  try {
    const result = await pool.query(`
      SELECT br.id, u.username
      FROM bank_recipients br
      JOIN users u ON u.id=br.recipient_user_id
      WHERE br.owner_user_id=$1 AND u.app='bank' AND u.role='bank_user'
      ORDER BY u.username`, [req.session.userId]);
    res.json({recipients:result.rows});
  } catch(error) {fail(res,error);}
});

app.post('/api/bank/recipients', requireApp('bank'), async (req,res) => {
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9_.-]{1,80}$/.test(username))
    return res.status(400).json({error:'Enter a valid Banking username.'});
  try {
    const recipient = await pool.query(
      `SELECT id,username FROM users WHERE app='bank' AND role='bank_user' AND lower(username)=lower($1)`,
      [username]);
    if(!recipient.rowCount) return res.status(404).json({error:'Banking recipient not found.'});
    const recipientId=recipient.rows[0].id;
    if(String(recipientId)===String(req.session.userId))
      return res.status(400).json({error:'You cannot add yourself as a recipient.'});
    const result=await pool.query(`
      INSERT INTO bank_recipients(owner_user_id,recipient_user_id)
      VALUES ($1,$2)
      ON CONFLICT(owner_user_id,recipient_user_id) DO UPDATE
      SET recipient_user_id=EXCLUDED.recipient_user_id
      RETURNING id`, [req.session.userId,recipientId]);
    res.json({message:'Recipient saved.',recipient:{id:result.rows[0].id,username:recipient.rows[0].username}});
  } catch(error) {fail(res,error);}
});

app.delete('/api/bank/recipients/:id', requireApp('bank'), async (req,res) => {
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid recipient ID.'});
  try {
    const result=await pool.query(
      `DELETE FROM bank_recipients WHERE id=$1 AND owner_user_id=$2 RETURNING id`,
      [req.params.id,req.session.userId]);
    if(!result.rowCount) return res.status(404).json({error:'Recipient not found.'});
    res.json({message:'Recipient removed.'});
  } catch(error) {fail(res,error);}
});

app.get('/api/bank/person-transfers', requireApp('bank'), async (req,res) => {
  try {
    const result=await pool.query(`
      SELECT pt.id,pt.sender_user_id,pt.recipient_user_id,pt.from_kind,
             pt.amount_cents,pt.created_at,
             sender.username AS sender_username,
             receiver.username AS recipient_username
      FROM bank_person_transfers pt
      JOIN users sender ON sender.id=pt.sender_user_id
      JOIN users receiver ON receiver.id=pt.recipient_user_id
      WHERE pt.sender_user_id=$1 OR pt.recipient_user_id=$1
      ORDER BY pt.id DESC LIMIT 100`, [req.session.userId]);
    res.json({transfers:result.rows.map(row=>({
      id:row.id,from_kind:row.from_kind,amount_cents:row.amount_cents,
      created_at:row.created_at,sender_username:row.sender_username,
      recipient_username:row.recipient_username,
      direction:String(row.sender_user_id)===String(req.session.userId)?'outgoing':'incoming'
    }))});
  } catch(error) {fail(res,error);}
});

app.post('/api/bank/send-money', requireApp('bank'), async (req,res) => {
  const {recipientId,from,amountCents,requestId}=req.body||{};
  if(!/^\d+$/.test(String(recipientId)) ||
     !['chequing','savings'].includes(from) ||
     !Number.isSafeInteger(amountCents) || amountCents<1 || amountCents>100000000 ||
     typeof requestId!=='string' ||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
    return res.status(400).json({error:'Invalid transfer details.'});
  const client=await pool.connect().catch(error=>{fail(res,error);return null;});
  if(!client) return;
  try {
    await client.query('BEGIN');
    const saved=await client.query(`
      SELECT br.recipient_user_id,u.username
      FROM bank_recipients br JOIN users u ON u.id=br.recipient_user_id
      WHERE br.id=$1 AND br.owner_user_id=$2 AND u.app='bank' AND u.role='bank_user'`,
      [recipientId,req.session.userId]);
    if(!saved.rowCount) {await client.query('ROLLBACK');return res.status(404).json({error:'Saved recipient not found.'});}
    const recipient=saved.rows[0];
    if(String(recipient.recipient_user_id)===String(req.session.userId)) {
      await client.query('ROLLBACK');return res.status(400).json({error:'Cannot send money to yourself.'});
    }
    // Lock both users in stable ID order to serialize concurrent payments.
    await client.query(`SELECT id FROM users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE`,
      [[req.session.userId,recipient.recipient_user_id]]);
    const prior=await client.query(`
      SELECT id FROM bank_person_transfers WHERE sender_user_id=$1 AND request_id=$2`,
      [req.session.userId,requestId]);
    if(prior.rowCount) {await client.query('COMMIT');return res.json({message:'Transfer already processed.',receiptId:prior.rows[0].id});}
    const debit=await client.query(`
      UPDATE bank_accounts SET balance_cents=balance_cents-$1
      WHERE user_id=$2 AND kind=$3 AND balance_cents >= $1 RETURNING id`,
      [amountCents,req.session.userId,from]);
    if(!debit.rowCount) {await client.query('ROLLBACK');return res.status(409).json({error:'Insufficient fictional funds.'});}
    const credit=await client.query(`
      UPDATE bank_accounts SET balance_cents=balance_cents+$1
      WHERE user_id=$2 AND kind='chequing' RETURNING id`,
      [amountCents,recipient.recipient_user_id]);
    if(!credit.rowCount) {await client.query('ROLLBACK');return res.status(409).json({error:'Recipient Chequing account not found.'});}
    const receipt=await client.query(`
      INSERT INTO bank_person_transfers(sender_user_id,recipient_user_id,from_kind,amount_cents,request_id)
      VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [req.session.userId,recipient.recipient_user_id,from,amountCents,requestId]);
    await client.query('COMMIT');
    res.json({message:'Fictional transfer sent to '+recipient.username+'.',receiptId:receipt.rows[0].id});
    logEventInBackground(req.session.userId,'bank','person_transfer',
      'Fictional person-to-person transfer');
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});fail(res,error);}
  finally {client.release();}
});

// ==================================================
// 22. ACADIA STUDENT PROFILE
// ==================================================

app.get(
  "/api/acadia/profile",
  requireAcadiaRole("student"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           user_id,
           display_name,
           program,
           year_of_study,
           tuition_cents
         FROM student_profiles
         WHERE user_id=$1`,
        [req.session.userId]
      );

      res.json({
        profile: result.rows[0] || null
      });

    } catch (error) {
      fail(res, error);
    }
  }
);

// ==================================================
// 23. ACADIA COURSES AND GRADES
// ==================================================

app.get(
  "/api/acadia/courses",
  requireAcadiaRole("student"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           user_id,
           code,
           title,
           term,
           grade
         FROM student_courses
         WHERE user_id=$1
         ORDER BY code`,
        [req.session.userId]
      );

      res.json({
        courses: result.rows
      });

    } catch (error) {
      fail(res, error);
    }
  }
);


// ==================================================
// ACADIA TUITION PAYMENTS (FICTIONAL FUNDS ONLY)
// ==================================================

// Use the internal numeric user ID as a simulator student reference.
// It is displayed as AC + eight digits; it is NOT a real Acadia ID.
app.get("/api/acadia/payments", requireAcadiaRole("student"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount_cents, created_at, payer_username
       FROM tuition_payments WHERE student_user_id=$1
       ORDER BY id DESC LIMIT 50`, [req.session.userId]
    );
    res.json({payments:result.rows});
  } catch(error) { fail(res,error); }
});

app.get("/api/bank/tuition/student/:studentId", requireApp("bank"), async (req,res) => {
  const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());
  if(!match) return res.status(400).json({error:"Use a simulator student ID such as AC00000001"});
  try {
    const result = await pool.query(
      `SELECT sp.display_name, sp.tuition_cents, sp.user_id
       FROM student_profiles sp JOIN users u ON u.id=sp.user_id
       WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,
      [Number(match[1])]
    );
    if(!result.rowCount) return res.status(404).json({error:"Student ID not found"});
    const student=result.rows[0];
    res.json({student:{studentId:'AC'+String(student.user_id).padStart(8,'0'),
      name:student.display_name, tuitionCents:student.tuition_cents}});
  } catch(error) {fail(res,error);}
});

app.get("/api/bank/payments", requireApp("bank"), async (req,res) => {
  try {
    const result=await pool.query(
      `SELECT id, student_user_id, amount_cents, from_kind, created_at
       FROM tuition_payments WHERE bank_user_id=$1 ORDER BY id DESC LIMIT 50`,
      [req.session.userId]
    );
    res.json({payments:result.rows});
  } catch(error) {fail(res,error);}
});

app.post("/api/bank/pay-tuition", requireApp("bank"), async (req,res) => {
  const {studentId, from, amountCents, requestId}=req.body||{};
  const match=typeof studentId==='string' && /^AC([0-9]{8})$/.exec(studentId.toUpperCase());
  if(!match || !['chequing','savings'].includes(from) ||
     !Number.isSafeInteger(amountCents) || amountCents<1 || amountCents>100000000 ||
     typeof requestId!=='string' || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return res.status(400).json({error:'Invalid tuition payment details'});
  }
  const studentUserId=Number(match[1]);
  const client=await pool.connect().catch(error=>{fail(res,error);return null;});
  if(!client) return;
  try {
    await client.query('BEGIN');
    // Lock the payer and recipient in a stable order to prevent concurrent overspending.
    const locked=await client.query(
      `SELECT id FROM users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE`,
      [[req.session.userId,studentUserId]]
    );
    const prior=await client.query(
      `SELECT id FROM tuition_payments WHERE bank_user_id=$1 AND request_id=$2`,
      [req.session.userId,requestId]
    );
    if(prior.rowCount) {
      await client.query('COMMIT');
      return res.json({message:'Payment already processed',receiptId:prior.rows[0].id});
    }
    const student=await client.query(
      `SELECT sp.tuition_cents FROM student_profiles sp JOIN users u ON u.id=sp.user_id
       WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student' FOR UPDATE OF sp`,
      [studentUserId]
    );
    if(!student.rowCount) {await client.query('ROLLBACK');return res.status(404).json({error:'Student not found'});}
    if(BigInt(student.rows[0].tuition_cents)<BigInt(amountCents)) {
      await client.query('ROLLBACK');return res.status(409).json({error:'Amount exceeds tuition owing'});
    }
    const balance=await client.query(
      `UPDATE bank_accounts SET balance_cents=balance_cents-$1
       WHERE user_id=$2 AND kind=$3 AND balance_cents >= $1 RETURNING id`,
      [amountCents,req.session.userId,from]
    );
    if(!balance.rowCount) {await client.query('ROLLBACK');return res.status(409).json({error:'Insufficient fictional funds'});}
    await client.query('UPDATE student_profiles SET tuition_cents=tuition_cents-$1 WHERE user_id=$2',
      [amountCents,studentUserId]);
    const payer=await client.query('SELECT username FROM users WHERE id=$1',[req.session.userId]);
    const receipt=await client.query(
      `INSERT INTO tuition_payments (bank_user_id,student_user_id,payer_username,from_kind,amount_cents,request_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.session.userId,studentUserId,payer.rows[0].username,from,amountCents,requestId]
    );
    await client.query('COMMIT');
    res.json({message:'Fictional tuition payment successful',receiptId:receipt.rows[0].id});
    logEventInBackground(req.session.userId,'bank','tuition_payment','Simulated Acadia tuition payment');
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});fail(res,error);}
  finally {client.release();}
});

// ==================================================
// 24. SECURITY EVENT HISTORY
// ==================================================

app.get("/api/security/events", async (req, res) => {
    // Require authenticated session and MFA.
    if (!req.session.mfa || !req.session.userId) {
        return res.status(401).json({
            error: "Sign in first"
        });
    }

    try {
        // Retrieve only the signed-in user's events.
        const result = await pool.query(
            `SELECT
                id,
                app,
                event_type,
                detail,
                created_at
             FROM security_events
             WHERE user_id = $1
             ORDER BY id DESC
             LIMIT 100`,
            [req.session.userId]
        );

        res.json({
            events: result.rows
        });

    } catch (error) {
        fail(res, error);
    }
});

// ==================================================
// 25. SERVER HEALTH CHECK
// ==================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "running"
    });

  } catch (error) {
    console.error(
      "[HEALTH] Database unavailable:",
      error.message
    );

    res.status(503).json({
      status: "database unavailable"
    });
  }
});


function requireDefenderSession(req, res, next) {
  if (!req.session.mfa || !req.session.userId) {
    return res.status(401).json({ error: "Please sign in first." });
  }
  next();
}

app.get("/api/security/defender", requireDefenderSession, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT enabled FROM lab_defender_settings WHERE user_id=$1",
      [req.session.userId]
    );
    res.json({ enabled: result.rows[0]?.enabled ?? true });
  } catch (error) {
    fail(res, error);
  }
});

app.post("/api/security/defender", requireDefenderSession, async (req, res) => {
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be true or false." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO lab_defender_settings (user_id, enabled)
       VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now()
       RETURNING enabled`,
      [req.session.userId, req.body.enabled]
    );
    res.json({ enabled: result.rows[0].enabled });
  } catch (error) {
    fail(res, error);
  }
});

app.get("/api/security/defender/events", requireDefenderSession, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT actor_username, to_jsonb(incident)->>'attacker_username' AS attacker_username,
              target, scenario, mode, record_id, attempted_value, outcome,
              detail, created_at
       FROM lab_incidents AS incident
       WHERE actor_user_id=$1
       ORDER BY id DESC LIMIT 100`,
      [req.session.userId]
    );
    res.json({ events: result.rows });
  } catch (error) {
    fail(res, error);
  }
});

installSchoolRoutes(app, pool, requireAcadiaRole);
installSchoolServices(app, pool, requireAcadiaRole);

// ==================================================
// AI AGENT - runs the thin 3-tool agent server-side
// ==================================================
// This is the same script exposed as `npm run ai` on the command line, so the
// web console and the terminal produce identical results. The design is
// deliberately minimal: a general-purpose scanner hands its model roughly 44
// tools, and free models given that many choices spend every turn on planning
// tools such as create_todo and get_threat_model without ever issuing an
// attack. This agent offers three, which a small model can actually choose
// between.
//
// Output is streamed as Server-Sent Events so the panel shows progress live.
// Requires a signed-in, MFA-verified session, because it spawns a process.
app.get("/api/ai-agent/run", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "Sign in as a lab user before running the agent"
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const steps = Math.max(
    1,
    Math.min(20, Number(req.query.steps) || 6)
  );

  const send = (event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const agentRoot = path.dirname(
    fileURLToPath(import.meta.url)
  );

  // The public HTTPS URL is used rather than http://127.0.0.1:3000 on
  // purpose: the session cookie is marked Secure, so Express will not
  // issue it over plain HTTP and every login would fail at the MFA step.
  const target =
    process.env.PUBLIC_ORIGIN ||
    "https://shekin.tail97139a.ts.net";

  send("start", { steps, target });

  const child = spawn(
    process.execPath,
    [path.join(agentRoot, "tools", "ai-agent.mjs")],
    {
      cwd: agentRoot,
      env: {
        ...process.env,
        AI_BASE: target,
        AI_MAX_STEPS: String(steps),
        AI_DEADLINE_MS: "900000"
      }
    }
  );

  let pending = "";

  const emit = chunk => {
    pending += chunk.toString();

    const parts = pending.split(/\r?\n/);
    pending = parts.pop() ?? "";

    for (const line of parts) {
      if (line.trim()) {
        send("log", { line });
      }
    }
  };

  child.stdout.on("data", emit);
  child.stderr.on("data", emit);

  child.on("error", error => {
    send("done", { ok: false, error: error.message });
    res.end();
  });

  child.on("close", code => {
    if (pending.trim()) {
      send("log", { line: pending });
    }

    send("done", { ok: code === 0, code });
    res.end();
  });

  // If the browser goes away, stop the child rather than leaving it running.
  req.on("close", () => {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  });
});

// Lets the AI Defender panel show the report the agent just wrote. The file
// lives inside the container, so this is the only way to reach it from the
// browser without mounting a host directory.
app.get("/api/ai-agent/report", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Sign in first" });
  }

  const reportPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "tools",
    "out",
    "AI-AGENT-REPORT.md"
  );

  if (!existsSync(reportPath)) {
    return res.status(404).json({
      error: "No report yet - run the agent first"
    });
  }

  res.type("text/markdown").send(readFileSync(reportPath, "utf8"));
});

// ==================================================
// 27. SERVE SMARTPHONE FRONTEND
// ==================================================

const directory = path.dirname(
  fileURLToPath(import.meta.url)
);

app.use(
  express.static(
    path.join(directory, "public")
  )
);

// ==================================================
// 28. START NODE.JS SERVER
// ==================================================

const port = Number(
  process.env.PORT || 3000
);

pool.query("SELECT 1")
  .then(() => {
    app.listen(port, process.env.HOST || "0.0.0.0", () => {
      console.log("================================");
      console.log("AI SMARTPHONE SECURITY SIMULATOR");
      console.log("================================");
      console.log(`Server listening on 0.0.0.0:${port}`);
      console.log("PostgreSQL-backed sessions enabled");
      console.log("Banking and Acadia authentication enabled");
      console.log("MFA authentication enabled");
      console.log("================================");
    });
  })
  .catch(error => {
    console.error("[STARTUP] Database connection failed:", error.message);
    process.exit(1);
  });
