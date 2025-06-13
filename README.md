# Bun File Server

A simple file hosting server built with Bun and Express, similar to catbox.moe.

## Features

- File upload with unique URLs
- 100MB file size limit
- Simple and clean web interface
- Direct file links for sharing
- Image previews and file type detection
- Grid and list views
- Sort by date, name, or size

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Docker and Docker Compose (for production deployment)

## Local Development

1. Clone this repository
2. Install dependencies:
```bash
bun install
```

3. Start the server:
```bash
bun start
```

4. Open your browser and navigate to `http://localhost:3000`

## Production Deployment

### Initial Setup

1. Clone the repository to your server:
```bash
git clone <repository-url> /opt/file_server
cd /opt/file_server
```

2. Make the deployment script executable:
```bash
chmod +x deploy.sh
```

3. Start the application:
```bash
docker-compose up -d
```

### Updating the Application

The deployment script provides several commands to manage the application:

1. Update the application (includes backup):
```bash
./deploy.sh update
```

2. Create a backup of uploaded files:
```bash
./deploy.sh backup
```

3. Restore from a backup:
```bash
./deploy.sh restore <backup-file>
```

4. List available backups:
```bash
./deploy.sh list-backups
```

### Backup Strategy

- Backups are stored in `/backup/file_server`
- Each backup is timestamped
- Backups are created automatically before updates
- You can restore from any backup if needed

### Volume Management

- Uploaded files are stored in a Docker named volume
- The volume persists even when containers are removed
- Backups are created before any major changes

## Configuration

- The server runs on port 3000 by default
- You can change the port by setting the `PORT` environment variable
- Maximum file size is set to 100MB

## License

MIT 