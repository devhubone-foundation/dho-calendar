# Nginx image for the local `prod` Compose profile only (ARCHITECTURE.md
# §17.3). The Render deployment builds its own combined image
# (Dockerfile.render) but reuses the same template + entrypoint unmodified.
FROM nginx:1.27-alpine

COPY docker/nginx/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY docker/scripts/nginx-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=80
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
