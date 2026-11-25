"""Check pandas data facts, generated-bank parity and all reference programs.

The check never exports questions or changes installed workspaces. Reference
programs run with only the three training CSVs in a temporary directory.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "workspace-template" / "mcm" / "pandas_kit"
BANK = ROOT / "workspace-template" / "bank"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    files = sorted(BANK.glob("py-mcm-*.json"))
    assert len(files) == 11
    watched = files + [ROOT / "mcm-bank.cjs", KIT / "week2_answers.py"] + sorted((KIT / "data").glob("*.csv"))
    before = {path: digest(path) for path in watched}
    raw = pd.read_csv(KIT / "data" / "level1_contest_raw.csv")
    assert raw.shape == (22, 5)
    assert int(raw["Score"].isna().sum()) == 2
    df = raw.copy()
    df.columns = df.columns.str.strip()
    df["School"] = df["School"].str.strip().str.upper()
    df["Score"] = pd.to_numeric(df["Score"], errors="coerce")
    assert (int(df.Score.isna().sum()), int(df.Score.notna().sum())) == (4, 18)
    assert df.loc[df.School.eq("XJTLU"), "Score"].mean() == 83.5
    clean = df.drop_duplicates()
    assert abs(clean.loc[clean.School.eq("XJTLU"), "Score"].mean() - 576 / 7) < 1e-10
    means = df.groupby("School")["Score"].mean()
    assert means.idxmax() == "SJTU"
    assert abs(means["SJTU"] - 251 / 3) < 1e-10
    zero_means = df.assign(Score=df.Score.fillna(0)).groupby("School")["Score"].mean()
    assert zero_means.idxmax() == "HIT"
    assert zero_means["HIT"] == 79.25
    assert zero_means["SJTU"] == 62.75

    week2_answers = KIT / "week2_answers.py"
    installed_export = KIT / "data" / "level1_clean.csv"
    installed_export_before = digest(installed_export) if installed_export.exists() else None
    with tempfile.TemporaryDirectory(prefix="pandas_week2_answers_") as temporary:
        run_root = Path(temporary)
        data_dir = run_root / "mcm" / "pandas_kit" / "data"
        data_dir.mkdir(parents=True)
        for name in ("level1_contest_raw.csv", "level2_scores_raw.csv", "level2_teams_raw.csv"):
            shutil.copyfile(KIT / "data" / name, data_dir / name)
        script = run_root / "week2_answers.py"
        shutil.copyfile(week2_answers, script)
        output = subprocess.run(
            [sys.executable, "-B", "-X", "utf8", str(script)], cwd=run_root,
            capture_output=True, text=True, encoding="utf-8", timeout=30,
        )
        assert output.returncode == 0, output.stderr
        exported = pd.read_csv(data_dir / "level1_clean.csv")
        assert exported.shape == (20, 9)
        assert "Unnamed: 0" not in exported.columns
        assert {"Score_raw", "Score_status", "Score_analysis", "Score_imputed"}.issubset(exported.columns)
        assert exported["Score_status"].value_counts().to_dict() == {
            "observed": 16, "unknown": 2, "absent": 2,
        }
        assert int(exported["Score_raw"].isna().sum()) == 2
        assert int(exported["Score"].isna().sum()) == 4
        assert int(exported["Score_analysis"].isna().sum()) == 2
        assert int(exported["Score_imputed"].sum()) == 2
        unknown = exported["Score_status"].eq("unknown")
        assert exported["Score_imputed"].equals(unknown)
        assert set(exported.loc[unknown, "Team ID"]) == {"T03", "T16"}
        pd.testing.assert_series_equal(
            exported.loc[~unknown, "Score_analysis"], exported.loc[~unknown, "Score"],
            check_names=False,
        )
        observed = exported["Score"].where(exported["Score_status"].eq("observed"))
        expected_means = observed.groupby(exported["Year"]).transform("mean")
        pd.testing.assert_series_equal(
            exported.loc[unknown, "Score_analysis"], expected_means.loc[unknown],
            check_names=False,
        )
        retained = raw.copy()
        retained.columns = retained.columns.str.strip()
        retained = retained.drop_duplicates().dropna(subset=["Year"]).set_index("Team ID")
        pd.testing.assert_series_equal(
            exported.set_index("Team ID")["Score_raw"], retained["Score"], check_names=False,
        )
        assert "合并: 16 -> 16" in output.stdout
        print("PASS week2_answers.py; isolated CSV export/readback (20, 9); provenance retained")
    if installed_export_before is None:
        assert not installed_export.exists(), "isolated check created export in installed workspace"
    else:
        assert digest(installed_export) == installed_export_before, "isolated check changed export in installed workspace"

    scores = pd.read_csv(KIT / "data" / "level2_scores_raw.csv")
    teams = pd.read_csv(KIT / "data" / "level2_teams_raw.csv")
    for frame in (scores, teams):
        frame["team_id"] = frame["team_id"].str.strip().str.upper()
    assert len(scores.merge(teams, on="team_id")) == 17
    teams = teams.drop_duplicates()
    assert not teams.team_id.duplicated().any()
    assert len(scores.merge(teams, on="team_id", how="left", validate="many_to_one")) == 16

    # Import the generation source; do not invoke its exporting CLI.
    result = subprocess.run(
        ["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1]).questions))", str(ROOT / "mcm-bank.cjs")],
        capture_output=True, text=True, encoding="utf-8", check=True, timeout=20,
    )
    source = {q["id"]: q for q in json.loads(result.stdout)}
    assert set(source) == {path.stem for path in files}
    for path in files:
        question = json.loads(path.read_text(encoding="utf-8"))
        assert source[question["id"]] == question, f"source/export mismatch: {path.name}"
        assert question["content_version"] == "1.1"
        assert question["reference_code"].startswith("import pandas as pd")
        with tempfile.TemporaryDirectory(prefix="pandas_reference_") as temporary:
            run_root = Path(temporary)
            data_dir = run_root / "mcm" / "pandas_kit" / "data"
            data_dir.mkdir(parents=True)
            for name in ("level1_contest_raw.csv", "level2_scores_raw.csv", "level2_teams_raw.csv"):
                shutil.copyfile(KIT / "data" / name, data_dir / name)
            script = run_root / "reference.py"
            script.write_text(question["reference_code"], encoding="utf-8")
            output = subprocess.run(
                [sys.executable, "-B", str(script)], cwd=run_root,
                capture_output=True, text=True, encoding="utf-8", timeout=30,
            )
            assert output.returncode == 0, f"{question['id']}: {output.stderr}"
            expected = question["test_cases"][0]["expected_stdout"]
            assert expected in output.stdout, f"{question['id']}: {output.stdout!r}"
            print("PASS", question["id"], output.stdout.strip())
    assert all(digest(path) == previous for path, previous in before.items()), "source files changed during check"
    print("PASS Python", sys.version.split()[0], "pandas", pd.__version__, "10 references; source/export parity; source files unchanged")


if __name__ == "__main__":
    main()
