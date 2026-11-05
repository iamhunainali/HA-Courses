// JOB 1: "portal-build"  -> jab bhi code push ho, naye images build karo aur phir deploy job trigger karo
pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '15')) }
  triggers { githubPush() }            // GitHub webhook. Webhook na ho to ye line hata kar: pollSCM('H/2 * * * *')
  environment { IMAGE_TAG = "${env.BUILD_NUMBER}" }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build images') {
      steps {
        withCredentials([file(credentialsId: 'portal-env', variable: 'ENV_FILE')]) {
          sh '''
            cp "$ENV_FILE" .env
            docker compose build
            docker tag learning-portal-backend:${IMAGE_TAG}  learning-portal-backend:latest
            docker tag learning-portal-frontend:${IMAGE_TAG} learning-portal-frontend:latest
            rm -f .env
          '''
        }
      }
    }

    stage('Trigger deploy') {
      steps {
        // Naya image ban gaya -> stack update ka job chalao
        build job: 'portal-deploy', wait: false, parameters: [string(name: 'IMAGE_TAG', value: env.IMAGE_TAG)]
      }
    }
  }
  post { failure { echo 'Build failed: stack ko touch nahi kiya gaya.' } }
}
