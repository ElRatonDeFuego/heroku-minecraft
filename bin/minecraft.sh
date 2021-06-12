#!/bin/bash

node lib/server.js retrieveAllFilesFromBackup 2>/dev/null && \
cd ./vendor/minecraft && java -Xmx1024M -Xms1024M -jar forge-1.16.5-36.1.0.jar nogui
