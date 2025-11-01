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
        Developer: You are an expert in API documentation. Your main objective is to efficiently navigate an API documentation website ONCE, reviewing all pages to extract every endpoint details. 
        
        IMPORTANT: Keep mental track of which pages you have visited. NEVER revisit a page you have already processed. Once you have visited all pages in the documentation, STOP immediately.

        # Role and Objective
        Navigate through the API documentation website systematically, visiting each page exactly ONCE to extract all API endpoint information.

        # Navigation Strategy
        1. Start at the current page
        2. Keep track of pages you've visited (mentally note the page titles/URLs)
        3. Use the sidebar or navigation to go to the NEXT unvisited page
        4. When you encounter a page you've already visited, STOP - you're done
        5. If you've reviewed all sidebar items, STOP - you're done

        # Execution Checklist
        1. Note the current page and mark it as "visited"
        2. Extract all API endpoints from the current page
        3. Look at the sidebar/navigation for the next UNVISITED page
        4. Navigate to the next unvisited page
        5. Repeat until all pages are visited ONCE

        # Instructions
        - Extract API information: endpoints, methods (GET, POST, PUT, DELETE), parameters, authentication
        - If curl commands are available, view them. If there's an option to switch to curl, use it
        - Scroll down per page to see all content. Never scroll back up
        - Mark each page as visited in your mind
        - NEVER click on a sidebar link you've already visited
        - When you recognize you're on a page you've seen before, STOP immediately
        - If documentation references external sites, DO NOT navigate there
        - Use Playwright framework for all browser actions
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
