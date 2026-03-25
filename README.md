# Navia - Full-Stack AI Travel Planner

A full-stack travel planning application with a FastAPI backend and Next.js frontend, enabling users to create trips, schedule activities across days, collaborate with other users, and visualize itineraries through interactive maps and procedurally-generated constellation artwork. **Currently a work in progress.**

## What It Is

A collaborative trip planner with REST API endpoints spanning the full travel planning workflow: user registration and JWT-based authentication, trip creation with timezone-aware date ranges, automatic day generation across trip dates, and rich activity management with geolocation, cost tracking, duration, energy levels, and "must-do" flags.

Key features include:
- **Trip Management:** Create, view, and delete trips with destination-based theme detection and automatic Day record generation for each date in the trip range
- **Activity Scheduling:** Add activities with full metadata (address, lat/lng, category, duration, cost, energy level), schedule them across days, or keep them in an unscheduled pool
- **Multi-User Collaboration:** Role-based trip sharing (owner/editor/viewer) via a collaborator junction table with owner-only access management
- **Constellation Visualization:** Procedurally-generated SVG artwork using seeded PRNG tied to trip IDs, representing activities as stars connected by constellation paths with staggered reveal animations and category-based nebula glows
- **Interactive World Map:** react-simple-maps integration with D3-based world atlas rendering activity location markers with hover tooltips
- **Dashboard:** Home page with expandable trip cards, upcoming/past trip separation, and per-day stats (activity count, total duration, total cost)

## Technologies

- Python, FastAPI, SQLAlchemy, Pydantic, Alembic
- Next.js, React, TypeScript, Tailwind CSS
- JWT authentication, bcrypt password hashing
- SQLite (development), PostgreSQL (production-ready)
- react-simple-maps 3.0.0 (D3-based world atlas), Lucide React icons
- 5 database models, 23 API endpoints, 16+ React components

## Summarized Bullets

- Architected a full-stack travel planner with a FastAPI REST API (23 endpoints) and Next.js 16 frontend (16+ components), implementing JWT authentication with 30-day token expiration, bcrypt password hashing, and role-based collaborative trip sharing across 5 SQLAlchemy models
- Designed a stratified activity management system supporting geolocation (lat/lng with bounds validation), cost and duration tracking, energy-level tagging, and category-based color coding, with Pydantic partial-update validation enabling flexible PATCH operations
- Built a procedurally-generated constellation visualization engine using seeded PRNG and SVG canvas, creating unique per-trip artwork with staggered reveal animations, radial nebula glows, and three responsive size variants (compact, default, full reveal)
- Integrated react-simple-maps with a D3-based world atlas for interactive trip mapping with activity location markers, and implemented automatic day generation, timezone-aware date handling, and SQLAlchemy cascade deletes for referential integrity across the trip-day-activity hierarchy
