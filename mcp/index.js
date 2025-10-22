import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "doc-collection-gen",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

server.tool("generate-openapi-documentation", "Generate OpenAPI documentation from url of API documentation page", {
    url: z.string().describe("The URL of the API documentation page"),
}, async ({ url }) => {
    return  {
        status: "success",
        message: "OpenAPI documentation generated successfully",
        url,   
    }
});


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});