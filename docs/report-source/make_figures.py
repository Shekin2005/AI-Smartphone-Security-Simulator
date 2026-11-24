"""Figures 1 and 2 for the report.

Figure 3 (the pipeline funnel) is produced by make_fig3.py. An earlier
time-comparison chart was removed: it plotted an estimated manual duration and
a request count that the agent harness never recorded, so it could not be
stood behind.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

NAVY = "#1F3A5F"
AMBER = "#C8963E"
GREY = "#8C8C8C"
LIGHT = "#E8EDF2"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 9,
    "axes.edgecolor": "#BFBFBF",
    "axes.linewidth": 0.8,
})


def fig1():
    """Research design: four stages from ground truth to interpretation."""
    fig, ax = plt.subplots(figsize=(7.2, 4.1), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis("off")

    stages = [
        (1.35, "1. Ground truth", "Manual source review\nand runtime confirmation;\ntwo-engine agreement", LIGHT, NAVY),
        (3.85, "2. Four engines", "Manual · deterministic suite\n· LLM agent ·\nmulti-agent pipeline", LIGHT, NAVY),
        (6.35, "3. Scoring", "Recall · precision ·\nfalse positives · time ·\ncost · interventions", LIGHT, NAVY),
        (8.85, "4. Interpretation", "Laboratory result read\nagainst published\nindustry evidence", "#F6EFDF", AMBER),
    ]
    for x, title, sub, fill, edge in stages:
        ax.add_patch(FancyBboxPatch((x - 1.1, 3.2), 2.2, 3.6,
                                    boxstyle="round,pad=0.05,rounding_size=0.14",
                                    linewidth=1.1, edgecolor=edge, facecolor=fill))
        ax.text(x, 6.2, title, ha="center", va="center", fontsize=8.4,
                color=edge, fontweight="bold")
        ax.text(x, 4.7, sub, ha="center", va="center", fontsize=6.9, color="#333333")

    for x in (2.5, 5.0, 7.5):
        ax.add_patch(FancyArrowPatch((x + 0.02, 5.0), (x + 0.24, 5.0),
                                     arrowstyle="-|>", mutation_scale=10,
                                     linewidth=1.0, color=GREY))

    ax.text(5.0, 8.55, "Research design", ha="center", fontsize=10.5,
            color=NAVY, fontweight="bold")
    ax.text(5.0, 2.35,
            "Same credentials, same target, same scoring rules for every engine;\nfailed runs preserved as evidence.",
            ha="center", fontsize=7.6, color="#555555", style="italic")
    ax.plot([1.6, 8.4], [1.95, 1.95], color="#D9D9D9", linewidth=0.8)

    fig.tight_layout(pad=0.3)
    fig.savefig("fig1_design.png", bbox_inches="tight", facecolor="white")
    plt.close(fig)


def fig2():
    """Ground-truth findings reported versus merely detected or analysed."""
    engines = ["Manual\nreview", "Deterministic\nsuite", "LLM\nagent", "Multi-agent\npipeline"]
    reported = [3, 3, 0, 0]
    detected = [0, 0, 1, 3]

    x = np.arange(len(engines))
    w = 0.34

    fig, ax = plt.subplots(figsize=(6.6, 3.5), dpi=300)
    b1 = ax.bar(x - w / 2, reported, w, label="Reported as a finding", color=NAVY)
    b2 = ax.bar(x + w / 2, detected, w, label="Detected or analysed, not reported", color=AMBER)

    for bars in (b1, b2):
        for b in bars:
            h = b.get_height()
            ax.text(b.get_x() + b.get_width() / 2, h + 0.06, f"{int(h)}",
                    ha="center", va="bottom", fontsize=8.2, color="#333333")

    ax.set_ylabel("Findings (of 3 ground-truth defects)", fontsize=8.6)
    ax.set_xticks(x)
    ax.set_xticklabels(engines, fontsize=8.3)
    ax.set_ylim(0, 3.8)
    ax.set_yticks([0, 1, 2, 3])
    ax.legend(frameon=False, fontsize=7.6, loc="upper right")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", color="#E6E6E6", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_title("Recall against ground truth, by engine", fontsize=9.4,
                 color=NAVY, loc="left", pad=8)

    fig.tight_layout(pad=0.4)
    fig.savefig("fig2_recall.png", bbox_inches="tight", facecolor="white")
    plt.close(fig)


if __name__ == "__main__":
    fig1()
    fig2()
    print("figures 1 and 2 written")
