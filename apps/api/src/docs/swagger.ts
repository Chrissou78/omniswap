import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpecification } from './openapi';

export function setupSwagger(app: Express): void {
  // Swagger UI options
  const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2.5rem }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; }
    `,
    customSiteTitle: 'OmniSwap API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  };

  // Serve OpenAPI spec as JSON
  app.get('/api/v1/docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpecification);
  });

  // Serve Swagger UI
  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpecification, swaggerUiOptions)
  );

  // Redoc alternative
  app.get('/api/v1/redoc', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OmniSwap API - ReDoc</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url='/api/v1/docs/openapi.json'></redoc>
          <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `);
  });
}
