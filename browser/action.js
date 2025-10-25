/**
 * This fucntion contains the actions that the browser can perform and cane be used to perform those actions.
 */

// async function handleBrowserAction(page, action) {
//     const actionType = action.type;

//     try {
//         switch (actionType) {
//             case 'click': {
//                 const { x, y, button = 'left' } = action;
//                 console.log(`Action: click at (${x}, ${y}) with button '${button}'`);
//                 await page.mouse.click(x, y, { button });
//                 break;
//             }

//             case 'scroll': {
//                 const { x, y, scroll_x, scroll_y } = action;
//                 console.log(
//                     `Action: scroll at (${x}, ${y}) with offsets (scrollX=${scroll_x}, scrollY=${scroll_y})`
//                 );
//                 // Move mouse to the coordinates (optional, not strictly needed for scrolling)
//                 await page.mouse.move(x, y);

//                 page.mouse.wheel(scroll_x, scroll_y);
//                 break;
//             }

//             case 'keypress': {
//                 let { keys } = action;

//                 keys = keys.reduce((a, b) => a + '+' + b, '');
//                 await page.keyboard.press(keys);

//                 // for (const k of keys) {
//                 //     console.log(`Action: keypress '${k}'`);
//                 //     // A simple mapping for common keys; expand as needed.
//                 //     if (k == "ENTER") {
//                 //         await page.keyboard.press("Enter");
//                 //     } else if (k.includes("SPACE")) {
//                 //         await page.keyboard.press(" ");
//                 //     } else {
//                 //         await page.keyboard.press(k);
//                 //     }
//                 // }
//                 break;
//             }

//             case 'type': {
//                 const { text } = action;
//                 console.log(`Action: type text '${text}'`);
//                 await page.keyboard.type(text);
//                 break;
//             }

//             case 'wait': {
//                 console.log(`Action: wait`);
//                 await page.waitForTimeout(2000);
//                 break;
//             }

//             case 'screenshot': {
//                 // Nothing to do as screenshot is taken at each turn
//                 console.log(`Action: screenshot`);
//                 break;
//             }

//             //{ type: 'drag', path: [ { x: 1017, y: 642 }, { x: 1019, y: 765 } ] }

//             case 'drag': {
//                 const { path } = action;
//                 console.log(
//                     `Action: drag at (${path[0].x}, ${path[0].y}) to (${path[1].x}, ${path[1].y})`
//                 );
//                 await page.mouse.move(path[0].x, path[0].y);
//                 await page.mouse.down();

//                 for (let i = 1; i < path.length; i++) {
//                     const point = path[i];
//                     await page.mouse.move(point.x, point.y, { steps: 10 }); // steps = smoothness
//                 }

//                 await page.mouse.up();

//                 break;
//             }

//             // Handle other actions here

//             default:
//                 console.log('Unrecognized action:', action);
//         }
//     } catch (e) {
//         console.error('Error handling action', action, ':', e);
//     }
// }

async function handleBrowserAction(page, actionData) {
    const actionType = actionData.action;

    try {
        switch (actionType) {
            case 'screenshot': {
                // Nothing to do as screenshot is taken at each turn
                console.log(`Action: screenshot`);

                break;
            }

            case 'mouse_move': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: mouse_move to (${x}, ${y})`);
                await page.mouse.move(x, y);
                break;
            }

            case 'left_click': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: left_click at (${x}, ${y})`);
                await page.mouse.click(x, y, { button: 'left' });
                break;
            }

            case 'right_click': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: right_click at (${x}, ${y})`);
                await page.mouse.click(x, y, { button: 'right' });
                break;
            }

            case 'middle_click': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: middle_click at (${x}, ${y})`);
                await page.mouse.click(x, y, { button: 'middle' });
                break;
            }

            case 'double_click': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: double_click at (${x}, ${y})`);
                await page.mouse.click(x, y, { button: 'left', clickCount: 2 });
                break;
            }

            case 'triple_click': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: triple_click at (${x}, ${y})`);
                await page.mouse.click(x, y, { button: 'left', clickCount: 3 });
                break;
            }

            case 'left_click_drag': {
                const { start_coordinate, coordinate } = actionData;
                const [startX, startY] = start_coordinate;
                const [endX, endY] = coordinate;
                console.log(
                    `Action: left_click_drag from (${startX}, ${startY}) to (${endX}, ${endY})`
                );
                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.mouse.move(endX, endY, { steps: 10 });
                await page.mouse.up();
                break;
            }

            case 'left_mouse_down': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: left_mouse_down at (${x}, ${y})`);
                await page.mouse.move(x, y);
                await page.mouse.down();
                break;
            }

            case 'left_mouse_up': {
                const { coordinate } = actionData;
                const [x, y] = coordinate;
                console.log(`Action: left_mouse_up at (${x}, ${y})`);
                await page.mouse.move(x, y);
                await page.mouse.up();
                break;
            }

            case 'type': {
                const { text } = actionData;
                console.log(`Action: type text '${text}'`);
                await page.keyboard.type(text);
                break;
            }

            case 'hold_key': {
                const { key } = actionData;
                console.log(`Action: hold_key '${key}'`);
                await page.keyboard.down(key);
                break;
            }

            case 'scroll': {
                const { coordinate, scroll_direction, scroll_amount } = actionData;
                const [x, y] = coordinate;

                // Convert scroll direction and amount to pixel offsets
                // scroll_amount is typically 1-5, multiply by a pixel factor (e.g., 100 pixels per unit)
                const pixelPerUnit = 100;
                let scroll_x = 0;
                let scroll_y = 0;

                if (scroll_direction === 'down') {
                    scroll_y = scroll_amount * pixelPerUnit;
                } else if (scroll_direction === 'up') {
                    scroll_y = -scroll_amount * pixelPerUnit;
                } else if (scroll_direction === 'left') {
                    scroll_x = -scroll_amount * pixelPerUnit;
                } else if (scroll_direction === 'right') {
                    scroll_x = scroll_amount * pixelPerUnit;
                }

                console.log(
                    `Action: scroll at (${x}, ${y}) direction '${scroll_direction}' amount ${scroll_amount} (scrollX=${scroll_x}, scrollY=${scroll_y})`
                );

                // Move mouse to the coordinates (optional)
                await page.mouse.move(x, y);
                await page.mouse.wheel({ deltaX: scroll_x, deltaY: scroll_y });
                break;
            }

            case 'keypress': {
                let { keys } = actionData;
                keys = keys.reduce((a, b) => a + '+' + b, '');
                await page.keyboard.press(keys);
                break;
            }

            case 'wait': {
                console.log(`Action: wait`);
                await page.waitForTimeout(2000);
                break;
            }

            case 'drag': {
                const { path } = actionData;
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
                console.log('Unrecognized action:', actionData);
        }
    } catch (e) {
        console.error('Error handling action', actionData, ':', e);
    }
}

export default handleBrowserAction;
