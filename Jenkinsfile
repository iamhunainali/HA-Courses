// Docker Swarm STACK pipeline:
//   stack "portal" pehle se hai  -> UPDATE (rolling, fail par auto-rollback)
//   stack nahi hai               -> CREATE (swarm bhi init, volumes bhi bana deta hai)
// Data volumes external hain aur kahin delete nahi hotay.
pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '15')) }
  triggers { githubPush() }            // webhook nahi hai to: pollSCM('H/2 * * * *')
  environment {
    STACK     = 'portal'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    PGVOL     = 'learning-portal_portal_pgdata'
    UPVOL     = 'learning-portal_portal_uploads'
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Prepare env') {
      steps {
        withCredentials([file(credentialsId: 'portal-env', variable: 'ENV_FILE')]) {
          sh 'cp "$ENV_FILE" .env'
        }
      }
    }

    stage('Ensure swarm') {
      steps {
        sh '''
          STATE=$(docker info --format '{{.Swarm.LocalNodeState}}')
          if [ "$STATE" != "active" ]; then
            echo "Swarm active nahi, init kar raha hun"
            docker swarm init
          fi
          docker info --format 'Swarm: {{.Swarm.LocalNodeState}}, manager: {{.Swarm.ControlAvailable}}'
        '''
      }
    }

    stage('Build images') {
      steps {
        sh '''
          docker build -t learning-portal-backend:${IMAGE_TAG}  -t learning-portal-backend:latest  ./backend
          docker build -t learning-portal-frontend:${IMAGE_TAG} -t learning-portal-frontend:latest ./frontend
        '''
      }
    }

    stage('Ensure volumes') {
      steps {
        sh '''
          for v in "$PGVOL" "$UPVOL"; do
            if docker volume inspect "$v" >/dev/null 2>&1; then echo "volume $v: found, reuse (data safe)"
            else echo "volume $v: creating"; docker volume create "$v"; fi
          done
        '''
      }
    }

    stage('Free old compose containers') {
      steps {
        // Pehle compose se chal rahe containers port 80 rokte hain. Sirf containers hatay jate hain, volumes nahi.
        sh '''
          OLD=$(docker ps -aq --filter label=com.docker.compose.project=learning-portal)
          if [ -n "$OLD" ]; then echo "Removing old compose containers (volumes untouched)"; docker rm -f $OLD; else echo "No old compose containers"; fi
        '''
      }
    }

    stage('Deploy / Update stack') {
      steps {
        sh '''
          if docker stack ls --format '{{.Name}}' | grep -qx "$STACK"; then echo ">>> Stack '$STACK' exists: UPDATING"; else echo ">>> Stack '$STACK' not found: CREATING"; fi
          set -a; . ./.env; set +a
          export IMAGE_TAG
          docker stack deploy --resolve-image never --prune -c docker-stack.yml "$STACK"
        '''
      }
    }

    stage('Verify rollout') {
      steps {
        sh '''
          for i in $(seq 1 60); do
            OK=1
            for s in db backend frontend; do
              REP=$(docker service ls --filter name=${STACK}_${s} --format '{{.Name}} {{.Replicas}}' | grep "^${STACK}_${s} " | awk '{print $2}')
              UPD=$(docker service inspect --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}' ${STACK}_${s})
              case "$UPD" in rollback_started|rollback_completed|paused) echo "Service $s update failed ($UPD)"; exit 1;; esac
              [ "$REP" = "1/1" ] || OK=0
              [ -z "$UPD" ] || [ "$UPD" = "completed" ] || OK=0
            done
            [ $OK = 1 ] && { echo "All services healthy"; docker stack services $STACK; exit 0; }
            sleep 5
          done
          echo "Timeout: services ready nahi hui"; exit 1
        '''
      }
    }
  }

  post {
    failure {
      sh '''
        docker stack services $STACK || true
        docker stack ps $STACK --no-trunc | head -20 || true
        docker service logs --tail 40 ${STACK}_backend || true
      '''
    }
    success { sh 'docker image prune -f || true' }
    always  { sh 'rm -f .env' }
  }
}
