import unittest
from quickstart_config import isolated_compose
class IsolationTest(unittest.TestCase):
 def test_every_named_resource_is_scoped_to_the_new_project(self):
  original={'name':'shared','networks':{'default':{'name':'airborne_server_default'}},'volumes':{'db':{'name':'live-db'}},'services':{'postgres':{'container_name':'live-postgres','ports':['5432:5432']},'redis':{}}}
  config=isolated_compose(original,{'db':1234})
  self.assertNotIn('name',config['networks']['default'])
  self.assertNotIn('name',config['volumes']['db'])
  self.assertNotIn('name',config)
  self.assertNotIn('redis',config['services'])
  self.assertEqual(config['services']['postgres']['ports'][0]['host_ip'],'127.0.0.1')
  self.assertEqual(original['networks']['default']['name'],'airborne_server_default')
if __name__=='__main__':unittest.main()
