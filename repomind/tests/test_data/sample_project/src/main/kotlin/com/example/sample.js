// Sample JavaScript file for testing

// TODO: refactor this function
function processData(data) {
    let result = {};
    for (let item of data) {
        if (item && item.length > 0) {
            result[item.id] = item.value;
        }
    }
    return result;
}

class DataHandler {
    constructor(config) {
        this.config = config;
        this.apiUrl = "https://api.example.com";
        this.apiKey = "sk-js-1234567890abcdef1234567890";
    }

    // FIXME: add error handling
    async fetchData(id) {
        const response = await fetch(`${this.apiUrl}/items/${id}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        return response.json();
    }

    complexFunction(x, y, z) {
        if (x > 0) {
            if (y > 0) {
                for (let i = 0; i < 10; i++) {
                    while (i < 5) {
                        if (i % 2 === 0) {
                            console.log(i);
                        } else {
                            console.log(-i);
                        }
                    }
                }
                return true;
            }
        }
        return false;
    }

    duplicateLogic(items) {
        let result = [];
        for (let item of items) {
            if (item !== null) {
                if (item.length > 0) {
                    result.push(item);
                }
            }
        }
        return result;
    }

    duplicateLogicCopy(items) {
        let result = [];
        for (let item of items) {
            if (item !== null) {
                if (item.length > 0) {
                    result.push(item);
                }
            }
        }
        return result;
    }
}

const { PI } = Math;
const unused = require('unused-module');

module.exports = { processData, DataHandler };
