export const sampleOpenApiJson = JSON.stringify(
  {
    openapi: '3.0.1',
    servers: [{ url: 'http://localhost:8701' }],
    paths: {
      '/api/v1/mcp/get_company_employee': {
        post: {
          summary: '获取公司雇员信息',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GetCompanyEmployeeRequest' },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        GetCompanyEmployeeRequest: {
          type: 'object',
          description: '查询雇员信息请求',
          required: ['city', 'company'],
          properties: {
            city: {
              type: 'string',
              description: '城市名称，例如 beijing',
            },
            company: {
              type: 'object',
              description: '公司信息',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  description: '公司名称',
                },
                type: {
                  type: 'string',
                  description: '公司类型',
                },
              },
            },
          },
        },
      },
    },
  },
  null,
  2,
)
