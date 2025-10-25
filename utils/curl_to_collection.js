import { validate, convert } from 'curl-to-postmanv2';

// The convert function uses an error first callback system.
// Wrapping it around a promise so we don't need to use callbacks.
function curlToRequest(curlString) {
    return new Promise((resolve, reject) => {
        if (!validate(curlString).result) {
            reject(Error('Invalid curl provided'));
        }

        convert({ type: 'string', data: curlString }, (err, result) => {
            if (err) {
                reject(Error(err));
            }

            if (result.result && result.output[0].type === 'request') {
                resolve(result.output[0].data);
            }
        });
    });
}

async function curlArrToCollection(curlArr, metadata) {
    // Convert all the curl objects to a request object and modify their description
    const collection = {
        info: {
            name: metadata.apiName,
            description: metadata.apiDescription,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
    };

    // First Check if this is a valid curl. If it isn't, this object is a doc descriptor.
    // Append the description to the previous requests description.
    // for(let index = 0; index < curlArr.length; index++){
    // 	const { curl, description } = curlArr[index];

    // 	/**
    // 	 * @todo - This approach doesn't account for when there are multiple concurrent descriptors. Fix that.
    // 	 */
    // 	if(!validate(curl).result){
    // 		// console.log("Invalid curl => ", curlArr[index]);
    //         if(index + 1 < curlArr.length){
    // 			// Merge the description to that of the next curl object
    // 			curlArr[index + 1].description = `${description} \n ${curlArr[index + 1].description}`

    // 			// Delete the object with the invalid curl
    // 			curlArr.splice(index, 1);
    // 		} else{
    // 			// If the last object in the array has an invalid curl, merge it to the element before it.
    // 			curlArr[index - 1].description = `${description} \n ${curlArr[index - 1].description}`
    // 			curlArr.pop();
    // 		}
    //     }
    // }

    curlArr = await Promise.all(
        curlArr.map(async ({ curl, description, title }) => {
            if (!validate(curl).result) {
                curl = 'curl https://postman-echo.com/get';
            }

            const request = await curlToRequest(curl);
            request.description = description;

            return { name: title, request };
        })
    );
    collection.item = curlArr;

    return collection;
}

export default curlArrToCollection;
