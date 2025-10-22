import schemas from './schema.js';

const PLAYWRIGHT_KEYS = [
    // Modifiers / special
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'ControlOrMeta',
    'ShiftLeft',
    'ShiftRight',
    'AltLeft',
    'AltRight',
    'ControlLeft',
    'ControlRight',
    'MetaLeft',
    'MetaRight',

    // Printable / letters digits
    'KeyA',
    'KeyB',
    'KeyC',
    'KeyD',
    'KeyE',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyI',
    'KeyJ',
    'KeyK',
    'KeyL',
    'KeyM',
    'KeyN',
    'KeyO',
    'KeyP',
    'KeyQ',
    'KeyR',
    'KeyS',
    'KeyT',
    'KeyU',
    'KeyV',
    'KeyW',
    'KeyX',
    'KeyY',
    'KeyZ',

    'Digit0',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',

    // Numpad
    'Numpad0',
    'Numpad1',
    'Numpad2',
    'Numpad3',
    'Numpad4',
    'Numpad5',
    'Numpad6',
    'Numpad7',
    'Numpad8',
    'Numpad9',
    'NumpadAdd',
    'NumpadSubtract',
    'NumpadMultiply',
    'NumpadDivide',
    'NumpadDecimal',
    'NumpadEnter',
    'NumpadEqual',

    // Function keys
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'F12',
    'F13',
    'F14',
    'F15',
    'F16',
    'F17',
    'F18',
    'F19',
    'F20',
    'F21',
    'F22',
    'F23',
    'F24',

    // Navigation / editing
    'Backspace',
    'Delete',
    'Enter',
    'Tab',
    'Escape',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Insert',

    // Symbol / punctuation / other keys
    'Backquote', // ` and ~
    'Minus', // - and _
    'Equal', // = and +
    'BracketLeft', // [ and {
    'BracketRight', // ] and }
    'Backslash', // \ and |
    'Semicolon', // ; and :
    'Quote', // ' and "
    'Comma', // , and <
    'Period', // . and >
    'Slash', // / and ?

    'Space',
    'CapsLock',
    'ScrollLock',
    'NumLock',
    'Pause',
    'PrintScreen',
    'ContextMenu',
];

const prompts = {
    browser_use_prompt: `
        Developer: You are an expert in API documentation. Your main objective is to efficiently navigate an API documentation website, reviewing all pages to extract every endpoint details. If you cannot find needed information on a page, move on quickly to the next. 
        Use the documentation sidebar or any other pagination means to navigate the page and determine when you have visited every page on the documentation website; do not stop after the first API documentation page, but ensure you navigate through all available pages to be comprehensive.

        Begin with a concise checklist (3-7 bullets) outlining your high-level approach before starting extraction. As you process each page, if curl commands or API request information are not available, clearly state assumptions or unknown values in the description field.

        # Role and Objective
        Your task is to review the provided API documentation and view every API request. You should persuse the entirety of the documentation website to view every API request.

        # Execution Checklist
        1. Analyze the shared API documentation, using the sidebar or other pagination features to ensure all pages are covered.
        2. View every relevant API endpoints and actions.
        3. View every relevant documentation page.
        4. If the default code sample is a code snippet, switch to curl.

        # Instructions
        - Review API documentation thoroughly but efficiently, ensuring you traverse every page using the sidebar or pagination features.
        - Identify all API requests/actions, including authorization/authentication processes and HTTP verbs (GET, POST, PUT, DELETE, etc.).
        - If curl commands are included in the docs, view them. If the default are code snippets and there is an option to switch to curl, switch to curl.
        - If the docs allow switching code samples to curl, use that option.
        - Do not doom scrolling, scroll only as much as needed to view the page. Never scroll back up when you've already scrolled down to see the page content. 
        - If documentation is not complete on the page or website, never navigate to a new domain or web page.
        - The framework being used is Playwright. Make the parameters object of the computer use tool based on the Playwright framework.
    `,

    curl_docs_prompt: `
        Developer: You are an expert in API documentation review. Your goal is to efficiently examine the provided API documentation page (including all connected/relevant pages) and extract detailed endpoint information.

        Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.

        # Role and Objective
        Review the provided API documentation screenshot to create a comprehensive curl Documentation array for each API request or relevant documentation section found. All generated documentation should be clear, complete, and use Markdown formatting for descriptions.

        # Execution Checklist
        1. Review the shared API documentation and related pages.
        2. Extract details for all API endpoints and actions, avoiding duplicates.
        3. Gather all available parameter and authorization details.
        4. Organize extracted data into a structured curl documentation array.
        5. Format all request descriptions and parameter tables using Markdown.

        # Instructions
        - Carefully review each API documentation page and identify all API requests/actions, including those related to authorization/authentication and all HTTP methods (GET, POST, PUT, DELETE, etc.).
        - If curl commands are present in the documentation, extract and include them; if only code snippets are available, convert them to curl commands; otherwise, construct curl commands from the information provided.
        - Before including each documentation object, briefly summarize the purpose and required inputs for context.
        - After writing each documentation object, confirm completeness (method, endpoint, parameters) with a 1-2 sentence validation. If information is missing, make clear notes or state assumptions.
        - Provide a Markdown-formatted description with all available context, steps, and embedded images for each API request. Include Markdown parameter tables.
        - For documentation pages that do not contain API requests, include only the page description or outlined steps (as found), setting other fields to null as appropriate.
        - All descriptions must be formatted in Markdown.
        - Include tags relevant to the current documentation page or section, or use an empty array if unavailable.
        - Only generate one curl documentation array per page—combine all requests from the page into a single array without duplicating requests in multiple arrays.

        Output Format:

        - ALWAYS respond with JSON format conforming to the provided output scheme
        - NEVER include any other text or formatting in your response asides the conforming JSON response

        After documenting, for each provided documentation object, validate the extracted information in 1-2 sentences, confirming method, endpoint, and parameter completeness, and self-correct or clarify if validation fails.
    `,

    openapi_gen_prompt: `
        Developer: You are an OpenAPI documentation generator. Your goal is to generate a comprehensive OpenAPI documentation for the provided API documentation (including all connected/relevant pages).
        The OpenAPI documentation should be in JSON format.
        The API documentation will be provided to you as an array of curl documentation objects. Each object represents an API request.

        # Role and Objective
        Generate a comprehensive OpenAPI documentation for the provided API documentation (including all connected/relevant pages).

        # Execution Checklist
        1. Review the provided API documentation and related requests.
        2. Extract details for all API endpoints and actions, avoiding duplicates.
        3. Gather all available parameter and authorization details.
        4. Organize extracted data into a structured OpenAPI definition.
        5. Format all request descriptions and parameter tables using Markdown.
        6. Include all the provided information in the OpenAPI definition.
    `,
};

export default prompts;
