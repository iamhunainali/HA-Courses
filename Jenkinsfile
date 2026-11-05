// Single pipeline: images build + stack deploy/update (stack pehle se ho to update, na ho to create).
// Volumes (portal_pgdata, portal_uploads) kabhi delete nahi hotay: "down -v" / "volume rm" kahin use nahi hua.
pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '15')) }
  triggers { githubPush() }            // webhook nahi hai to: pollSCM('H/2 * * * *')
  environment {
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    LAST_GOOD = "${env.JENKINS_HOME}/portal_last_good_tag"
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

    stage('Build images') {
      steps {
        sh '''
          docker compose build
          docker tag learning-portal-backend:${IMAGE_TAG}  learning-portal-backend:latest
          docker tag learning-portal-frontend:${IMAGE_TAG} learning-portal-frontend:latest
        '''
      }
    }

    stage('Deploy / Update stack') {
      steps {
        sh '''
          # Volumes na hon to bante hain, hon to wahi reuse hotay hain (data safe)
          docker volume inspect learning-portal_portal_pgdata  >/dev/null 2>&1 && echo "pgdata volume found: reuse"  || echo "pgdata volume will be created"
          docker volume inspect learning-portal_portal_uploads >/dev/null 2>&1 && echo "uploads volume found: reuse" || echo "uploads volume will be created"

          # Stack nahi bana to create; bana hua hai to sirf badle hue containers recreate
          docker compose up -d --remove-orphans
        '''
      }
    }

    stage('Health check') {
      steps {
        sh '''
          for i in $(seq 1 30); do
            if docker compose exec -T backend node -e "fetch('http://localhost:3000/api/categories').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
              echo "Backend healthy"; echo "$IMAGE_TAG" > "$LAST_GOOD"; exit 0
            fi
            sleep 5
          done
          echo "Health check failed"; exit 1
        '''
      }
    }
  }

  post {
    success { sh 'docker image prune -f || true' }
    failure {
      // Naya version fail ho to pichla chalta hua tag wapis (volumes wahi, data loss nahi)
      sh '''
        if [ -f "$LAST_GOOD" ]; then
          PREV=$(cat "$LAST_GOOD"); echo "Rolling back to tag $PREV"
          IMAGE_TAG=$PREV docker compose up -d --remove-orphans || true
        fi
      '''
    }
    always { sh 'rm -f .env' }
  }
}
