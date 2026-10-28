import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Arba Minch University — KPI Monitoring System API',
    version: '2.0.0',
    description: `
### AMU KPI Monitoring System REST API Documentation

Interactive OpenAPI / Swagger documentation parsed directly from inline JSDoc annotations in every module route file.
All routes are served under **/api/v1** and follow MODULES_SPECIFICATION.html.

#### Authentication Instructions:
1. Go to **Auth** -> **POST /api/v1/auth/login**.
2. Click **Try it out**, enter credentials, and execute.
3. Complete any REQUIRE_PASSWORD_CHANGE / REQUIRE_MFA_* step the response asks for.
4. The server sets HTTP-only **token** and **refresh_token** cookies; protected endpoints authenticate via the cookie.
5. Endpoints guarded by a permission code return 403 unless one of your roles grants it.
    `,
    contact: {
      name: 'AMU KPI System Administration',
      email: 'admin@amu.edu.et',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Host Relative URL (Default - Same-Origin Cookies)',
    },
    {
      url: 'http://localhost:8058',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'Session cookie set automatically by the browser upon login',
      },
    },
  },
  // Cookie auth applies to every operation unless it declares `security: []`
  security: [{ CookieAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, '../modules/**/*.routes.js').replace(/\\/g, '/'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

const swaggerUiOptions = {
  customSiteTitle: 'AMU KPI Monitoring — API Docs',
  customCss: `
    .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #3b82f6; }
    .swagger-ui .topbar .topbar-wrapper img { content: url('https://img.icons8.com/color/48/university.png'); width: 36px; height: 36px; }
    .swagger-ui .info { margin: 24px 0; }
    .swagger-ui .info .title { color: #1e293b; font-weight: 700; }
    .swagger-ui .btn.authorize { background-color: #059669; color: white; border-color: #059669; font-weight: 600; }
    .swagger-ui .btn.authorize svg { fill: white; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
    withCredentials: true,
  },
};

export { swaggerSpec, swaggerUi, swaggerUiOptions };
