#!/bin/bash

# Configuration
BACKUP_DIR="/backup/file_server"
APP_DIR="/opt/file_server"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Function to backup uploads
backup_uploads() {
    echo "Creating backup of uploads..."
    docker run --rm \
        --volumes-from file-server \
        -v $BACKUP_DIR:/backup \
        ubuntu tar cvf /backup/uploads_$DATE.tar /app/uploads
    echo "Backup created at $BACKUP_DIR/uploads_$DATE.tar"
}

# Function to restore uploads
restore_uploads() {
    if [ -z "$1" ]; then
        echo "Please provide backup file name"
        exit 1
    fi
    
    echo "Restoring uploads from $1..."
    docker run --rm \
        --volumes-from file-server \
        -v $BACKUP_DIR:/backup \
        ubuntu bash -c "rm -rf /app/uploads/* && tar xvf /backup/$1 -C /"
    echo "Restore completed"
}

# Function to update the application
update_app() {
    echo "Updating application..."
    
    # Backup current uploads
    backup_uploads
    
    # Pull latest changes
    cd $APP_DIR
    git pull origin main
    
    # Rebuild and restart containers
    docker-compose down
    docker-compose build
    docker-compose up -d
    
    echo "Update completed"
}

# Function to list available backups
list_backups() {
    echo "Available backups:"
    ls -lh $BACKUP_DIR/uploads_*.tar
}

# Main script
case "$1" in
    "update")
        update_app
        ;;
    "backup")
        backup_uploads
        ;;
    "restore")
        restore_uploads $2
        ;;
    "list-backups")
        list_backups
        ;;
    *)
        echo "Usage: $0 {update|backup|restore <backup-file>|list-backups}"
        exit 1
        ;;
esac 