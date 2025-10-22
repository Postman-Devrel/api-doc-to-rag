const schemas = {
    curl_docs_schema: {
        name: 'curl_docs_gen',
        type: 'json_schema',
        schema: {
            type: 'object',
            properties: {
                curlDocs: {
                    type: 'array',
                    description:
                        'An array of curl documentation objects extracted from the API documentation page.',
                    items: {
                        type: 'object',
                        properties: {
                            curl: {
                                type: 'string',
                                description:
                                    'The extracted curl command string for the API request.',
                            },
                            parameters: {
                                type: 'array',
                                description: 'The parameters of the API request.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: {
                                            type: 'string',
                                            description: 'The name of the parameter.',
                                        },
                                        type: {
                                            type: 'string',
                                            description: 'The type of the parameter.',
                                        },
                                        required: {
                                            type: 'boolean',
                                            description: 'Whether the parameter is required.',
                                        },
                                        description: {
                                            type: 'string',
                                            description: 'The description of the parameter.',
                                        },
                                    },
                                    required: ['name', 'type', 'required', 'description'],
                                    additionalProperties: false,
                                },
                            },
                            description: {
                                type: 'string',
                                description:
                                    'A detailed description of the curl command with all relevant information from the documentation page, formatted in Markdown.',
                            },
                            tags: {
                                type: 'string',
                                description:
                                    'The title of the current documentation page or section that can be used to identify all the request on this page.',
                            },
                        },
                        required: ['curl', 'parameters', 'description', 'tags'],
                        additionalProperties: false,
                    },
                    minItems: 1,
                },
                url: {
                    type: 'string',
                    description:
                        'The URL of the documentation page that the curl documentation was extracted from.',
                },
            },
            required: ['curlDocs', 'url'],
            additionalProperties: false,
        },
    },
};

export default schemas;
