/**
 * This fucntion contains the actions that the browser can perform and cane be used to perform those actions.
 */

async function handleBrowserAction(page, action) {
    const actionType = action.type;

    try {
        switch (actionType) {
            case 'click': {
                const { x, y, button = 'left' } = action;
                console.log(`Action: click at (${x}, ${y}) with button '${button}'`);
                await page.mouse.click(x, y, { button });
                break;
            }

            case 'scroll': {
                const { x, y, scroll_x, scroll_y } = action;
                console.log(
                    `Action: scroll at (${x}, ${y}) with offsets (scrollX=${scroll_x}, scrollY=${scroll_y})`
                );
                // Move mouse to the coordinates (optional, not strictly needed for scrolling)
                await page.mouse.move(x, y);

                page.mouse.wheel(scroll_x, scroll_y);
                break;
            }

            case 'keypress': {
                let { keys } = action;

                keys = keys.reduce((a, b) => a + '+' + b, '');
                await page.keyboard.press(keys);

                // for (const k of keys) {
                //     console.log(`Action: keypress '${k}'`);
                //     // A simple mapping for common keys; expand as needed.
                //     if (k == "ENTER") {
                //         await page.keyboard.press("Enter");
                //     } else if (k.includes("SPACE")) {
                //         await page.keyboard.press(" ");
                //     } else {
                //         await page.keyboard.press(k);
                //     }
                // }
                break;
            }

            case 'type': {
                const { text } = action;
                console.log(`Action: type text '${text}'`);
                await page.keyboard.type(text);
                break;
            }

            case 'wait': {
                console.log(`Action: wait`);
                await page.waitForTimeout(2000);
                break;
            }

            case 'screenshot': {
                // Nothing to do as screenshot is taken at each turn
                console.log(`Action: screenshot`);
                break;
            }

            //{ type: 'drag', path: [ { x: 1017, y: 642 }, { x: 1019, y: 765 } ] }

            case 'drag': {
                const { path } = action;
                console.log(
                    `Action: drag at (${path[0].x}, ${path[0].y}) to (${path[1].x}, ${path[1].y})`
                );
                await page.mouse.move(path[0].x, path[0].y);
                await page.mouse.down();

                for (let i = 1; i < path.length; i++) {
                    const point = path[i];
                    await page.mouse.move(point.x, point.y, { steps: 10 }); // steps = smoothness
                }

                await page.mouse.up();

                break;
            }

            // Handle other actions here

            default:
                console.log('Unrecognized action:', action);
        }
    } catch (e) {
        console.error('Error handling action', action, ':', e);
    }
}

export default handleBrowserAction;
