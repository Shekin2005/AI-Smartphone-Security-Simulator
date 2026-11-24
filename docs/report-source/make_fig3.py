"""Figure 3: the pipeline's detection funnel, from queued candidates to reported findings."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

NAVY = "#1F3A5F"
AMBER = "#C8963E"
GREY = "#8C8C8C"

stages = [
    ("7", "candidate findings\nqueued for exploitation", NAVY),
    ("3", "confirmed against\nground truth", NAVY),
    ("0", "reported in a final\nreport", "#B03A2E"),
]

fig, ax = plt.subplots(figsize=(6.6, 2.7), dpi=300)
ax.set_xlim(0, 10)
ax.set_ylim(0, 4.2)
ax.axis("off")

widths = [2.8, 2.3, 1.8]
xs = [0.9, 3.9, 6.5]
for (val, label, colour), w, x in zip(stages, widths, xs):
    ax.add_patch(FancyBboxPatch((x, 1.7), w, 1.5,
                                boxstyle="round,pad=0.04,rounding_size=0.12",
                                facecolor="white", edgecolor=colour, linewidth=1.2))
    ax.text(x + w / 2, 2.72, val, ha="center", va="center",
            fontsize=19, fontweight="bold", color=colour)
    ax.text(x + w / 2, 2.12, label, ha="center", va="center",
            fontsize=7.4, color="#333333")

for x0, x1 in ((3.75, 3.9), (6.25, 6.5)):
    ax.annotate("", xy=(x1, 2.45), xytext=(x0, 2.45),
                arrowprops=dict(arrowstyle="-|>", color=GREY, linewidth=1.0))

ax.text(8.55, 2.45, "run aborted at 42 min\nwhen the provider\nrevoked the API key",
        ha="left", va="center", fontsize=7.0, color="#B03A2E", style="italic")

ax.text(0.9, 3.45, "Shannon pipeline: from queued candidates to reported findings",
        fontsize=9.2, color=NAVY, fontweight="bold")
ax.text(0.9, 0.95, "The two candidates lost at the first step concerned money movement in a fictitious bank and were\n"
                   "not confirmed as vulnerabilities; the three that survived were the ground-truth defects.",
        fontsize=6.6, color="#555555", style="italic")

fig.tight_layout(pad=0.25)
fig.savefig("fig3_funnel.png", bbox_inches="tight", facecolor="white")
print("written fig3_funnel.png")
