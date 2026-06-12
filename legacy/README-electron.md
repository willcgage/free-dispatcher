 Free Dispatcher is a web-based administrative application designed for managing model train layouts and operations during events or exhibitions. The system
  provides CRUD (Create, Read, Update, Delete) functionality for organizing train layouts, districts, and dispatchers.

  Purpose & Domain

  This application serves the model railroad hobby community, specifically for:
  
Train shows and exhibitions where multiple layouts are displayed
Operating sessions that require coordination between multiple districts,
Event organization where dispatchers need to be assigned to specific areas,
Layout documentation with location and scheduling information,
,

  Architecture

  Electron Desktop Application

  
Frontend: React 19 + Vite (Single Page Application, rendered in Electron)
Backend: FastAPI + SQLAlchemy (RESTful API), bundled as a PyInstaller binary,
Database: SQLite by default (per-user storage), with optional PostgreSQL via DATABASE_URL,
Deployment: Packaged Electron app via electron-builder (Docker workflow retired in v0.7.0),
,

  Data Model

  The system manages three main entities:

  
Layouts - Event venues or exhibitions
Name, location (city/state), start/end dates,
Represents the overall event or show,
Districts - Radio communication zones within layouts,
Name, radio channel/frequency,
Belongs to a specific layout,
Represents operational areas that need coordination,
Dispatchers - People who manage train operations,
First name, last name, cell phone,
Global entities that can be assigned across layouts,
Coordinate train movements and communications,
,

  Key Features

  Administrative Interface

  
Dashboard: Overview of system status and layout selection
CRUD Management: Full create/read/update/delete for all entities,
Responsive Design: Works on desktop and mobile devices,
Theme Support: Light, dark, high-contrast, and system themes,
,

  Technical Features

  
Electron Shell: IPC-based backend URL resolution between the renderer and bundled backend
Bundled Backend: FastAPI service packaged as a standalone binary via PyInstaller,
API Documentation: FastAPI automatic OpenAPI/Swagger docs,
Real-time Updates: Dynamic form updates and data refresh,
,

  Current State

  Functional MVP (v0.7)

  
Complete CRUD operations for all entities
Packaged Electron desktop app with bundled backend,
Responsive web interface,
Database persistence with SQLite (PostgreSQL override supported),
,

  Development Stage

  This appears to be an early-stage project with:
  
Basic functionality implemented
Some technical debt and code quality issues,
Missing production-ready features (authentication, proper error handling),
Active development with version automation scripts,
,

  Use Case Example

  A model railroad club organizing a train show would:

  
Create a Layout for "2024 Spring Train Show" in "Denver, CO"
Add Districts like "Yard Operations" (Channel 1), "Mainline East" (Channel 2),
Register Dispatchers with their contact information,
Assign dispatchers to specific districts during the event,
Coordinate operations using the radio channels and contact info,
,

  Technical Context

  The project uses modern web development practices with:
  
React hooks for state management
Async/await patterns throughout,
Type safety with Pydantic schemas,
Database migrations (though currently using create_all),
Environment-based configuration for different deployment scenarios,
Git Large File Storage (LFS) for efficient handling of binary assets,
,

## Git LFS Support

This repository is configured with Git LFS to handle binary files efficiently:

- **Automatically tracked**: Images, videos, audio files, documents, fonts, executables, and 3D/CAD files
- **Setup**: Run `./app/scripts/lfs-helper.sh install` to initialize LFS
- **Documentation**: See `docs/GIT_LFS_GUIDE.md` for complete usage guide
- **Helper script**: Use `./app/scripts/lfs-helper.sh` for common LFS operations

  This is a specialized application serving the active model railroad community, providing digital tools to manage what has traditionally been a  paper-based coordination process.

  -- ReadME content by Dwight Kelly 
