"""Evaluate the real sandbox configuration expression without provisioning services."""
import argparse, ast, pathlib, unittest
SOURCE=pathlib.Path(__file__).with_name('quickstart.py')
class AddressTest(unittest.TestCase):
 def test_web_and_emulator_asset_origins(self):
  tree=ast.parse(SOURCE.read_text())
  expression=next(n for n in tree.body if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and isinstance(n.value.func.value,ast.Name) and n.value.func.value.id=='values' and n.value.func.attr=='update')
  for emulator,host in [(False,'localhost'),(True,'10.0.2.2')]:
   values={};scope={'values':values,'ports':dict(db=1,sp=2,kc=3,s3=4,api=8102,dashboard=8123),'issuer':'http://issuer','args':argparse.Namespace(android_emulator=emulator)}
   exec(compile(ast.Module(body=[expression],type_ignores=[]),str(SOURCE),'exec'),scope)
   self.assertEqual(values['PUBLIC_ENDPOINT'],f'http://{host}:8123')
   self.assertEqual(values['SERVER_HOST'],'127.0.0.1')
if __name__=='__main__':unittest.main()
