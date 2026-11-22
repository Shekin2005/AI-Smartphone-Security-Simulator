
"use strict";

// ==========================================
// ACADIA STUDENT AND ADMINISTRATOR PORTAL
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

  // ========================================
  // ACCOUNT SELECTION
  // ========================================

  const selection = document.getElementById(
    "acadia-role-selection"
  );

  const student = document.getElementById(
    "acadia-student-login-form"
  );

  const admin = document.getElementById(
    "acadia-admin-login-form"
  );

  const adminRegister = document.getElementById(
    "acadia-admin-register-form"
  );

  // Display only the selected account form
  function showRole(role) {

    const screens = {
  selection: selection,
  student: student,
  admin: admin,
  "admin-register": adminRegister,
  "admin-mfa": document.getElementById("acadia-admin-mfa"),
  "admin-dashboard": document.getElementById("acadia-admin-dashboard")
};

    Object.entries(screens).forEach(function ([name, element]) {
      if (element) {
        element.hidden = name !== role;
      }
    });

    console.log("Selected account:", role);
  }

  // ========================================
  // STUDENT LOGIN
  // ========================================

  document.getElementById("acadia-student-choice")
    ?.addEventListener("click", function () {
      showRole("student");
    });

  document.getElementById("acadia-student-back")
    ?.addEventListener("click", function () {
      showRole("selection");
    });

  // When returning from student registration,
  // display the Student Login form again.
  document.querySelectorAll(
    '[data-auth-panel="acadia:login"]'
  ).forEach(function (button) {

    button.addEventListener("click", function () {
      showRole("student");
    });

  });

  // ========================================
  // ADMINISTRATOR LOGIN
  // ========================================

  document.getElementById("acadia-admin-choice")
    ?.addEventListener("click", function () {
      showRole("admin");
    });

  document.getElementById("acadia-admin-back")
    ?.addEventListener("click", function () {
      showRole("selection");
    });

  // ========================================
  // ADMINISTRATOR REGISTRATION NAVIGATION
  // ========================================

  document.getElementById("acadia-admin-create-choice")
    ?.addEventListener("click", function () {
      showRole("admin-register");
    });

  document.getElementById("admin-register-back")
    ?.addEventListener("click", function () {
      showRole("admin");
    });

  
  // ========================================
  // ADMINISTRATOR LOGIN WITH MFA
  // ========================================

  const adminLoginButton = document.getElementById(
    "acadia-admin-login-button"
  );

  const adminMessage = document.getElementById(
    "acadia-admin-login-message"
  );

  adminLoginButton?.addEventListener("click", async function () {

    const username = document.getElementById(
      "acadia-admin-username"
    ).value.trim();

    const passwordInput = document.getElementById(
      "acadia-admin-password"
    );

    const password = passwordInput.value;

    if (!username || !password) {
      adminMessage.textContent =
        "Enter your administrator username and password.";
      return;
    }

    adminLoginButton.disabled = true;
    adminMessage.textContent = "Checking credentials...";

    try {
      const result = await apiRequest(
        "/auth/login",
        "POST",
        {
          app: "acadia",
          username: username,
          password: password,
          role: "admin"
        }
      );

      passwordInput.value = "";

      if (result.next === "enroll") {
        const setup = await apiRequest(
          "/auth/enroll",
          "POST",
          {}
        );

        document.getElementById(
          "acadia-admin-qr"
        ).src = setup.qr;

        document.getElementById(
          "acadia-admin-manual-key"
        ).textContent = "Manual key: " + setup.manualKey;

        showRole("admin-mfa");
      } else if (
        result.next === "verify" ||
        result.next === "otp"
      ) {
        showRole("admin-mfa");
      } else {
        throw new Error("Unexpected authentication response.");
      }

    } catch (error) {
      adminMessage.textContent = error.message;
    } finally {
      adminLoginButton.disabled = false;
    }
  });

  // ========================================
  // ADMINISTRATOR OTP VERIFICATION
  // ========================================

  document.getElementById("acadia-admin-verify-button")
    ?.addEventListener("click", async function () {

      const input = document.getElementById(
        "acadia-admin-otp-input"
      );

      const message = document.getElementById(
        "acadia-admin-otp-message"
      );

      this.disabled = true;
      message.textContent = "";

      try {
        const result = await apiRequest(
          "/auth/verify",
          "POST",
          { code: input.value.trim() }
        );

        if (
          result.app !== "acadia" ||
          result.role !== "admin"
        ) {
          throw new Error("Administrator access denied.");
        }

        input.value = "";

        document.getElementById(
          "acadia-admin-qr"
        ).removeAttribute("src");

        document.getElementById(
          "acadia-admin-manual-key"
        ).textContent = "";

        showRole("admin-dashboard");
        showAdminTab("students");

      } catch (error) {
        message.textContent = error.message;

        if (error.status === 429) {
          showRole("admin");
        }
      } finally {
        this.disabled = false;
      }
    });


  // ========================================
  // ADMINISTRATOR REGISTRATION
  // Backend integration is still required.
  // ========================================

  document.getElementById("admin-register-button")
    ?.addEventListener("click", function () {

      const message = document.getElementById(
        "admin-register-message"
      );

      if (message) {
        message.textContent =
          "Administrator registration requires backend setup.";
      }

    });

  // ========================================
  // ADMINISTRATOR DASHBOARD NAVIGATION
  // ========================================

  const adminTabs = [
    "students",
    "courses",
    "grades",
    "schedule",
    "tuition",
    "graduation",
    "degrees",
    "services"
  ];

  function showAdminTab(tab) {

    if (!adminTabs.includes(tab)) {
      return;
    }

    adminTabs.forEach(function (name) {

      const panel = document.getElementById(
        "admin-" + name
      );

      if (panel) {
        panel.hidden = name !== tab;
      }

    });

    document.querySelectorAll("[data-admin-tab]")
      .forEach(function (button) {

        button.classList.toggle(
          "active",
          button.dataset.adminTab === tab
        );

      });

  }

  document.querySelectorAll("[data-admin-tab]")
    .forEach(function (button) {

      button.addEventListener("click", function () {
        showAdminTab(button.dataset.adminTab);
      });

    });

  // ========================================
  // INITIAL STATE
  // ========================================

  showRole("selection");
  showAdminTab("students");

  console.log("Acadia role selection initialized");


});
