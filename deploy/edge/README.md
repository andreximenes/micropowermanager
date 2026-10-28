# Edge proxy (spark-paygops VPS)

A single Traefik owns ports 80/443 on the VPS and serves every app on it.
It used to live inside the PaygOps stack.
It now runs on its own, so stopping PaygOps no longer takes Spark CRM offline.

Apps attach to the external `edge` network and set `traefik.docker.network=edge` plus their router labels.
Certificates come from the `letsencrypt` resolver and are stored in the `edge_letsencrypt` volume.

```sh
sudo docker compose -f /opt/spark-crm/deploy/edge/docker-compose.yml up -d
```

Start this before any app: it creates the `edge` network the apps join.
