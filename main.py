"""NexusAuth Python entry point."""
from __future__ import annotations
import argparse
import json
from nexus_py.application import create_application

def main() -> int:
    parser = argparse.ArgumentParser(description="NexusAuth application")
    parser.add_argument("key", nargs="?", default="health")
    parser.add_argument("value", nargs="?", default="ok")
    args = parser.parse_args()
    result = create_application().handle(args.key, args.value)
    print(json.dumps(result, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
