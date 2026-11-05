#!/bin/sh
# Naya code/image build karke stack update karta hai. Volumes (data) touch nahi hotay.
# KABHI "docker compose down -v" mat chalana, warna volumes delete ho jayengay.
docker compose up -d --build
docker image prune -f
