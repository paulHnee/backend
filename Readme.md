# Backend API

This is the backend API for the application. It includes routes for user authentication, VPN management, and more. The API is built using Node.js, Express, and various middleware for security, logging, and rate limiting.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Routes](#routes)
- [Error Handling](#error-handling)
- [Security](#security)
- [License](#license)

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-repo/backend.git
    cd backend
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## Configuration

1. Create a `.env` file in the root directory and add the following environment variables:
    ```env
    PORT=5000
    JWT_SECRET=your_jwt_secret
    ALLOWED_ORIGINS=http://localhost:3000,http://10.1.1.45
    ```

2. Update the `config/corsConfig.js` file to include the allowed origins:
    ```javascript
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://10.1.1.45'];
    ```

## Usage

1. Start the server:
    ```bash
    npm start
    ```

2. The server will run on the port specified in the `.env` file (default is 5000).

## Routes

### Authentication

- **POST /api/login**
    - Description: User login
    - Request Body:
        ```json
        {
          "username": "string",
          "password": "string"
        }
        ```
    - Response:
        ```json
        {
          "message": "Login successful!",
          "token": "jwt_token"
        }
        ```

### VPN Management

- **GET /vpn**
    - Description: Access VPN route (protected)
    - Headers:
        ```json
        {
          "Authorization": "Bearer jwt_token"
        }
        ```
    - Response:
        ```json
        {
          "message": "Hello VPN! Welcome, username"
        }
        ```

- **POST /vpn/public_key**
    - Description: Insert a new public key and device
    - Request Body:
        ```json
        {
          "publickey": "string",
          "Device": "string"
        }
        ```
    - Response:
        ```json
        {
          "message": "Public key added successfully"
        }
        ```

## Error Handling

The API uses a centralized error handling middleware to handle errors and send appropriate responses to the client.

## Security

- **Helmet**: Adds security headers to the responses.
- **CORS**: Configured to allow requests from specified origins.
- **Rate Limiting**: Limits the number of requests per IP to prevent abuse.
- **JWT Authentication**: Secures routes using JSON Web Tokens.

## License

This project is licensed under the MIT License.