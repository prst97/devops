echo "Deploy: Builda e sobe containers"
docker compose down
docker compose build
docker compose up -d
