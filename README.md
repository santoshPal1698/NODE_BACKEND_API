Setup MogoDB
mogodb => "C:\Program Files\MongoDB\Server\5.0\bin/mongod.exe" --version  
mongoEXE => "C:\Program Files\MongoDB\Server\5.0\bin/mongo.exe" --version

# Run with PM2

Install the project dependencies and PM2, then start the production process:

```sh
npm install
npm install --global pm2
npm run pm2:start
```

The PM2 configuration runs `index.js` in single-process mode. Configure the
application's environment variables in the applicable `.env` file before
starting it. Useful commands:

```sh
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

To restore the process list after a server reboot, run `pm2 startup`, follow
the command PM2 prints, then run `pm2 save`.

# Node JS + Docker Setup & Configration


## Production: Docker Compose + NGINX load balancer (self-hosted / VPS)

This repository includes an NGINX configuration and a docker-compose file that runs
an NGINX reverse proxy in front of one or more app replicas and a Redis instance
used for session storage.

Files added/updated:
- docker/nginx.conf — NGINX configuration that proxies to the `app` service
- docker/conf.d/default.conf — placeholder
- docker-compose.yml — production-ready compose (app, redis, nginx)
- index.js — uses Redis session store and trust proxy

How it works (high level):
- NGINX receives incoming HTTP(S) requests and proxies them to the backend
  service named `app`.
- Run multiple `app` containers with `docker-compose up --scale app=3 -d`.
- Docker's embedded DNS resolves the service name `app` to the IPs of all
  running replicas; NGINX configuration uses runtime name resolution so it
  can discover backends dynamically.
- Sessions are stored in Redis, so any app replica can read session data.

Quick start (example on a VPS):
1) Build and start services (example using 3 app replicas):

   docker-compose build
   docker-compose up -d --scale app=3

2) Verify:
   - curl http://localhost/health
   - docker-compose ps
   - docker logs -f <nginx_container>

Notes about scaling and DNS
- docker-compose (non-swarm) supports runtime scaling via `--scale`.
- NGINX by default resolves backend hostnames only at startup. The provided
  nginx.conf uses Docker resolver (127.0.0.11) and proxy_pass via a variable
  so nginx re-resolves names periodically (valid=10s). This gives near-real
  time updates when replicas come and go.

Security (recommended)
- Terminate TLS at nginx (recommended). Use Certbot / Let's Encrypt on the
  host or run an additional container for certbot to manage certificates.
- Set NODE_ENV=production and ensure SESSION_SECRET and LIVEDB are set in the
  host environment or a .env used by docker-compose.

## Render / Managed Platform guidance

If deploying to Render, Fly, Heroku, or another managed platform:
- Do not run an in-project NGINX; use the platform's built-in load balancing
  and scaling features.
- Keep Redis as an external managed service (RedisCloud, Upstash, AWS Elasticache),
  and keep sessions stored there so horizontally scaled instances share state.
- The changes to index.js (trust proxy + Redis session store) are suitable for
  managed platforms where the platform's load balancer or TLS terminator sits
  in front of the app.

## Important application changes made
1) index.js
   - app.set('trust proxy', 1) when NODE_ENV=production so Express reads
     X-Forwarded-For and X-Forwarded-Proto from NGINX.
   - switched express-session to use Redis (connect-redis) so sessions are
     shared among replicas.
   - cookies configured secure/httpOnly/sameSite in production.

2) docker-compose.yml
   - added redis and nginx services and network configuration. Use
     `docker-compose up --scale app=3 -d` to run multiple app instances.

## Notes & next steps
- SSL/TLS: the compose file leaves TLS to you (nginx listens on 443 but
  certificate provisioning is not included). Use Certbot on the host or add
  a certbot container to the compose file.
- Healthchecks: The app exposes /health — keep it lightweight (no auth).
- Logging/Monitoring: Add a centralized log/metrics collector (Prometheus,
  Grafana, Loki) for production observability.

If you'd like, next steps I can implement for you:
- Add a minimal Certbot + nginx-letsencrypt compose example
- Add a simple Prometheus metrics endpoint and example scrape config
- Add a docker-compose prod file separate from development compose



1. step first for create a Dockerfile

FROM node:20-alpine AS base

WORKDIR /usr/src/backend-app

COPY package\*.json ./

RUN npm ci --only=production

COPY . .

RUN npm install

EXPOSE 3000

CMD ["npm", "start"]

2.  step create a build & Images

docker build -t node-backend-app:production<app-name> -f Dockerfile .

3. Step Run a Build

docker run -p 3000:3000<prefix your post Num here> node-backend-app <project-name>:production<Tag Name>

4. docker compose for all configration here

version: '3.8'

services:
app:
build: .
ports: - "3000:3000"
volumes: - .:/usr/src/app - /usr/src/app/node_modules
command: npm start

5. this Command used => docker-compose up

########## for terminal for powershell#######################################
mongo "mongodb+srv://studentsdemo.y2jgxd7.mongodb.net/studentsapi" --username santosh123

####################### CLUSTERDB#######################

CLUSTER_DB = "mongodb+srv://test123:pal123@$cluster0.bjxrmbt.mongodb.net/demodb?retryWrites=true&w=majority"
SECRET_KEY ="YOURjhfdhkghkdfghkhdghkhSECURITY_KEY"

mongodb+srv://santosh123:pal123@demodb.wa1hik2.mongodb.net/demodb

mongodb+srv://test123:**\***@cluster0.bjxrmbt.mongodb.net/demodb

Intialize DB => mongo
Database show => show dbs
view Collection => show collections
current Db show => db

// Create & Used Database => use DatabaseName
Ex:1 use students-api

Delete Collection & db
syntax: db.colleCtionName.drop()
Ex1 : db.registers.drop()

$$$$$$$$$$$$$$$$$$$$$$$$ -CRUD Querry -$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$

######################################--Create--########################################################

#Create Collection =>

// a) InsertOne:- Single Data Create.
db.DocumentName.insertOne()
Ex1 :db.registers.insertOne({name:"santosh" ,mobile:5445445646, email:"demo@gmail.com"})

// a) InsertMany:- Multiple Data Create.
db.DocumentName.InsertMany([{},{},{}])
Ex1 :db.registers.insertMany([
{name:"Ravi" ,mobile:8445445649, email:"ravi123@gmail.com"},
{name:"Raj" ,mobile:4545445610, email:"raj13@gmail.com"},
{name:"Ram" ,mobile:655445612, email:"ram456@gmail.com"},
{name:"Aman" ,mobile:8545445645, email:"aman789@gmail.com"},
])

Ex2: db.crudData.insertMany([
{name:"Ravi" ,mobile:8445445649, email:"ravi123@gmail.com"},
{name:"Raj" ,mobile:4545445610, email:"raj13@gmail.com"},
{name:"Ram" ,mobile:655445612, email:"ram456@gmail.com"},
{name:"Aman" ,mobile:8545445645, email:"aman789@gmail.com"},
])

######################################--Read--########################################################

Syntax : db.collection.find(query, projection) '#projection is 0 set not show any collection#'

1. All fields for db.
   Show Documents data => db.DocumentName.find().pretty()
   Ex:1 db.registers.find().pretty()
   Ex:2 db.students.find().pretty()

2. Find Praticular for only one fields.
   Ex1: db.crudData.find({name:"Ram"}).pretty()

3. Find Praticular Fileds for only one fields for withought id show in collection
   db.crudData.find({name:"Ram"},{ \_id:0,name:1})

4. Limit show Collection Data.
   Ex1 : (a). Limit db.crudData.find({name:"Ram"},{ \_id:0,name:1}) .limit(1)
   Ex2 : (b). skip db.crudData.find({name:"Ram"},{ \_id:0,name:1}) .skip(1)  
   Ex3 : (c). findOne db.crudData.findOne({name:"Ram"},{ \_id:0,name:1})

######################################--UPDATE--########################################################

Syntax :
1)updateOne()
(a). db.colleCtionName.updateOne(<filter>, <updatefileds>)  
Ex:1 db.crudData.updateOne({name:"Aman"},{$set:{email:"amar@gmail.com"}})

2)updateMany()
(b). db.colleCtionName.updateMany(<filter>, <updatefileds>)  
Ex-2 db.crudData.updateMany({name:"sani"},{$set:{email:"bobby@gmail.com"}})

######################################--DELETE--########################################################

Syntax :
1)deleteOne()
(a). db.colleCtionName.deleteOne(<filter>, <updatefileds>)  
Ex1. db.crudData.deleteOne({name:"raj"})

2)deleteMany()
(b). db.colleCtionName.deleteMany(<filter>, <updatefileds>)  
Ex2. db.crudData.deleteMany({name:"sani"})
(c). all collection Delete
Ex3. db.crudData.deleteMany({})
