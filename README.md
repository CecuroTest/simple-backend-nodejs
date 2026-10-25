# Very simple backend in nodejs

This is a backend that is extremely simplified. It is not really meant for anything else than quick prototyping or for demonstration purposes. It is NOT an example on how to write good node.js code or dockerize projects.

- Pure JS
- Yarn
- Dockerized, docker-compose'd
- SQL database (postgres) connection with sequelize
- Database admin
- Seeds + migrations
- Supports docker secrets
- Supports releasing docker images on docker hub or any other registry

## Generate seeds or migrations

`npx sequelize-cli migration:create --name name`
`npx sequelize-cli seed:generate --name name`

## Run in dev mode

`docker-compose build`
`docker-compose up -d`
`docker-compose exec api yarn migrate`
`docker-compose exec api yarn seed`

## API

- `GET /?limit=20&offset=0` — paged list (`limit` max 100).
- `POST /` — create `{"name": "...", "age": 3}`. Requires `Authorization: Bearer $API_WRITE_TOKEN`.
- `DELETE /:id` — remove a kitten. Requires the same bearer token.

Writes are disabled until `API_WRITE_TOKEN` is set. They are rate limited per IP
(`WRITE_RATE_LIMIT` per `WRITE_RATE_WINDOW_MS`) and capped at `MAX_KITTENS` rows.

## Test

`yarn test`

## Release

Copy `bin/release.env.example` to `bin/release.env`

`bash bin/release.sh`
