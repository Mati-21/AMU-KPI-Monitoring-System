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

// Swagger UI lists tags in the order of this array: show them module by module (Dev first)
const TAG_ORDER = [
  'Dev',
  'Auth',
  'Persons',
  'Offices',
  'Access Control',
  'KPI Catalog',
  'Contracts & Cascading',
  'Reporting Periods',
  'Performance Scoring',
  'Evidence & Documents',
  'Notifications',
  'System Governance',
];
const tagRank = (name) => (TAG_ORDER.includes(name) ? TAG_ORDER.indexOf(name) : TAG_ORDER.length);
swaggerSpec.tags = [...new Map((swaggerSpec.tags || []).map((tag) => [tag.name, tag])).values()].sort(
  (a, b) => tagRank(a.name) - tagRank(b.name)
);

// Dev-only routes (modules/00-dev) are documented only when they are actually mounted
if (process.env.NODE_ENV !== 'development') {
  for (const route of Object.keys(swaggerSpec.paths || {})) {
    if (route.startsWith('/api/v1/dev/')) delete swaggerSpec.paths[route];
  }
  swaggerSpec.tags = swaggerSpec.tags.filter((tag) => tag.name !== 'Dev');
}

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
