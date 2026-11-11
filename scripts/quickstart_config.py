"""Convert the maintained Compose definition into a project-scoped sandbox."""
import copy

def isolated_compose(source, ports):
    config = copy.deepcopy(source)
    keep = {'postgres', 'superposition-data-init', 'superposition', 'keycloak-db', 'keycloak', 'localstack'}
    config['services'] = {k: v for k, v in config['services'].items() if k in keep}
    for name, service in config['services'].items():
        service.pop('container_name', None)
        service.pop('restart', None)
        service['ports'] = []
        for target, key in {'postgres': [(5432, 'db')], 'superposition': [(8080, 'sp')], 'keycloak': [(8080, 'kc')], 'localstack': [(4566, 's3')]}.get(name, []):
            service['ports'].append({'target': target, 'published': str(ports[key]), 'host_ip': '127.0.0.1', 'protocol': 'tcp'})
    for kind in ('volumes', 'networks'):
        for resource in config.get(kind, {}).values():
            resource.pop('name', None)
            resource.pop('external', None)
    config.pop('name', None)
    return config
