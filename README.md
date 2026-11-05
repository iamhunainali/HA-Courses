# Learning Portal
Run: `cp .env.example .env` (passwords change karo) then `docker compose up -d --build`
Open: http://localhost
Super Admin (pehli dafa auto-create): admin@portal.com / Admin@12345  (.env mein change karo)
Update: `./update.sh`  — data (portal_pgdata, portal_uploads) safe rehta hai. `down -v` MAT chalao.

## Jenkins (Docker Swarm stack)
1. Jenkins usi server par ho jahan app chalani hai; Docker ho, `jenkins` user docker group mein ho.
2. Credentials -> Secret file, ID `portal-env` -> apni `.env`.
3. Ek Pipeline job, Script Path: `Jenkinsfile`.
Har build: swarm check/init -> images build -> volumes ensure -> `docker stack deploy` (stack ho to update, na ho to create) -> rollout verify.
Stack file: `docker-stack.yml`. Local dev ke liye `docker-compose.yml`. Volumes `learning-portal_portal_pgdata` / `learning-portal_portal_uploads` kabhi delete nahi hotay.
Stack hatana ho: `docker stack rm portal` (volumes bach jate hain).
