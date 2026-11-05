# Learning Portal
Run: `cp .env.example .env` (passwords change karo) then `docker compose up -d --build`
Open: http://localhost
Super Admin (pehli dafa auto-create): admin@portal.com / Admin@12345  (.env mein change karo)
Update: `./update.sh`  — data (portal_pgdata, portal_uploads) safe rehta hai. `down -v` MAT chalao.

## Jenkins (single Jenkinsfile)
1. Jenkins usi server par ho jahan app chalani hai; Docker + `docker compose` ho, `jenkins` user docker group mein ho.
2. Credentials -> Secret file, ID `portal-env` -> apni `.env` upload karo.
3. Ek Pipeline job (Pipeline script from SCM), Script Path: `Jenkinsfile`.
4. GitHub webhook: `http://<jenkins>/github-webhook/`
Har build: images build -> stack create/update -> health check -> fail par rollback. Volumes safe.
