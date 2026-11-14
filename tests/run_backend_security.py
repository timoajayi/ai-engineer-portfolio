"""Run the existing backend suite without writing to the backend checkout."""
import argparse
import os
from pathlib import Path
import sys
import unittest

from helpers.offline_backend_guard import install


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', required=True, type=Path)
    args = parser.parse_args()
    backend = args.backend.resolve()
    install(Path(__file__).resolve().parents[1], backend)
    sys.dont_write_bytecode = True
    os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
    os.chdir(backend)
    sys.path.insert(0, str(backend))
    suite = unittest.defaultTestLoader.discover(str(backend / 'tests'), top_level_dir=str(backend))
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(main())
