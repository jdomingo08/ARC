#!/usr/bin/env python3
"""Stream SkillSpector's LangGraph scan as NDJSON: one event per finished node, then the final report."""
import sys
import json


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main() -> int:
    args = sys.argv[1:]
    no_llm = "--no-llm" in args
    positional = [a for a in args if not a.startswith("--")]
    if not positional:
        emit({"type": "error", "message": "no input path provided"})
        return 2
    input_path = positional[0]

    try:
        from skillspector.graph import graph
        from skillspector.cli import _scan_state, FormatChoice
    except Exception as e:  # import/setup failure
        emit({"type": "error", "message": f"skillspector import failed: {e}"})
        return 2

    try:
        state = _scan_state(input_path, FormatChoice.json, no_llm, yara_rules_dir=None)
    except Exception as e:
        emit({"type": "error", "message": f"scan setup failed: {e}"})
        return 2

    final = {}
    try:
        for mode, chunk in graph.stream(state, stream_mode=["updates", "values"]):
            if mode == "updates" and isinstance(chunk, dict):
                for node in chunk.keys():
                    emit({"type": "step", "node": node})
            elif mode == "values" and isinstance(chunk, dict):
                final = chunk
        report = final.get("report_body")
        if not report and final.get("sarif_report") is not None:
            report = json.dumps(final["sarif_report"])
        emit({"type": "result", "report": report or ""})
        return 0
    except Exception as e:
        emit({"type": "error", "message": str(e)})
        return 2


if __name__ == "__main__":
    sys.exit(main())
