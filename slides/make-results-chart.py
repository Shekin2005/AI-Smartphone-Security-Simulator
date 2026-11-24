"""Chart for slide 8: ground-truth findings reported versus merely analysed."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BG = "#0B1220"
CYAN = "#38BDF8"
AMBER = "#FBBF24"
MUTED = "#93A4BF"
TEXT = "#E8EEF7"

engines = ["Manual\nreview", "Scripted\nsuite", "AI\nagent", "Shannon\npipeline"]
reported = [3, 3, 0, 0]
analysed = [0, 0, 1, 3]

x = np.arange(len(engines))
w = 0.36

fig, ax = plt.subplots(figsize=(6.2, 3.5), dpi=300)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

b1 = ax.bar(x - w / 2, reported, w, label="Reported as a finding", color=CYAN, zorder=3)
b2 = ax.bar(x + w / 2, analysed, w, label="Analysed but never reported", color=AMBER, zorder=3)

for bars in (b1, b2):
    for b in bars:
        h = b.get_height()
        ax.text(b.get_x() + b.get_width() / 2, h + 0.07, f"{int(h)}",
                ha="center", va="bottom", fontsize=11, color=TEXT, fontweight="bold")

ax.set_ylabel("Ground-truth findings (of 3)", fontsize=9, color=MUTED)
ax.set_xticks(x)
ax.set_xticklabels(engines, fontsize=8.5, color=TEXT)
ax.set_ylim(0, 3.7)
ax.set_yticks([0, 1, 2, 3])
ax.tick_params(axis="y", colors=MUTED, labelsize=8)
ax.tick_params(axis="x", length=0)

for spine in ("top", "right", "left"):
    ax.spines[spine].set_visible(False)
ax.spines["bottom"].set_color("#2A3F5F")

ax.grid(axis="y", color="#1E3050", linewidth=0.8, zorder=0)
ax.set_axisbelow(True)

leg = ax.legend(frameon=False, fontsize=8, loc="upper right", ncol=1)
for t in leg.get_texts():
    t.set_color(MUTED)

ax.set_title("Every engine could see the flaws. Only two could report them.",
             fontsize=9.5, color=TEXT, loc="left", pad=10)

fig.tight_layout(pad=0.35)
fig.savefig("fig-results.png", facecolor=BG, bbox_inches="tight")
print("written fig-results.png")
