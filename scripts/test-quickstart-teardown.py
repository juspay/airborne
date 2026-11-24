"""Exercise quickstart's actual child teardown without starting any services."""
import ast
import os
from pathlib import Path
import signal
import subprocess
import unittest


class TeardownTest(unittest.TestCase):
    def test_already_reaped_child_does_not_abort_cleanup(self):
        tree = ast.parse(Path(__file__).with_name('quickstart.py').read_text())
        final = next(node.finalbody for node in tree.body
                     if isinstance(node, ast.Try) and node.finalbody)
        child_loop = final[0]
        self.assertIsInstance(child_loop, ast.For)
        child = subprocess.Popen(['true'], start_new_session=True)
        child.wait()
        # Compile the source's teardown loop, with no Compose statements.
        code = compile(ast.Module(body=[child_loop], type_ignores=[]), 'quickstart.py', 'exec')
        exec(code, dict(os=os, signal=signal, subprocess=subprocess, processes=[child]))
        self.assertEqual(child.returncode, 0)


if __name__ == '__main__':
    unittest.main()
