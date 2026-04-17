# Data Classifier

A web application that classifies names based on gender, age, and nationality using external APIs. It stores profile data in a local SQLite database and provides RESTful API endpoints for managing profiles.

## Features

- **Profile Creation**: Submit a name to generate a profile with gender, age, age group, and country predictions.
- **Data Storage**: Persists profiles in an SQLite database with idempotent operations.
- **Profile Retrieval**: Fetch individual profiles or filter profiles by gender, country, or age group.
- **API Endpoints**: RESTful API for creating, reading, and deleting profiles.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd data-classifier
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

The server will run on `http://localhost:3000`.

## Usage

- **Web Interface**: Visit the root URL to access the HTML interface.
- **API**:
  - `POST /api/profiles`: Create a new profile by sending a JSON payload with `name`.
  - `GET /api/profiles`: Retrieve all profiles, optionally filtered by query parameters (`gender`, `country_id`, `age_group`).
  - `GET /api/profiles/:id`: Get a specific profile by ID.
  - `DELETE /api/profiles/:id`: Delete a profile by ID.

## Technologies

- **Backend**: Node.js, Express.js
- **Database**: SQLite with better-sqlite3
- **APIs**: Genderize.io, Agify.io, Nationalize.io
- **Other**: Axios for HTTP requests, UUID for unique IDs

## License

ISC