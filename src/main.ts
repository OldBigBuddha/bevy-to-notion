import { Client } from "@notionhq/client";
import { Failure, Result, Success } from "./result";

import "dotenv/config";

type ENV = {
    readonly NODE_ENV: string;
    readonly NOTION_API_KEY: string;
    readonly NOTION_PAGE_ID: string;
    // readonly NOTION_DATABASE_ID: string;
}

type Chapter = {
    readonly name: string;
}

type Event = {
    readonly title: string;
    readonly date: Date;
    readonly chapter: Chapter;
}

// from https://docs.bevy.com/technical-documentation/webhooks/payloads/events/example
const EXAMPLE_DATA = {
    "id": 12, 
    "title": "The Live Event", 
    "status": "Published", 
    "url": "https://example.com/event-page/", 
    "description_short": "Connect and have fun!", 
    "start_date": "2119-07-30T18:00:00-05:00", 
    "end_date": "2119-07-30T21:00:00-05:00",
    "event_type_id": 4, 
    "picture": {
    "url": "https://example.com/raw/event.jpg",
    "thumbnail_width": 400, 
    "thumbnail_height": 400, 
    "thumbnail_url": "https://example.com/thumb/event.jpg"  
    }, 
    "venue_name": "The Lab", 
    "venue_address": "1600 Main St", 
    "venue_city": "San Francisco", 
    "venue_zip_code": "132123",
    "created_ts": "2018-07-05T06:13:00-05:00",
    "updated_ts": "2018-07-09T17:57:00-05:00",
    "tickets": [
    {
        "id": 2146, 
        "title": "VIP", 
        "description": "Get a reserved seat and other perks.", 
        "sale_start_date": "2018-07-15T08:54:00-05:00", 
        "sale_end_date": "2018-10-15T21:00:00-05:00", 
        "min_per_order": 1, 
        "max_per_order": 4, 
        "price": 10.0, 
        "currency": "USD", 
        "is_for_sale": false, 
        "visible": true, 
        "waitlist_enabled": false
    }
    ],
    "publish_date": "2018-05-25T21:00:00-05:00",
    "published_by": {
    "id": 2600,
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@example.com"
    },
    "description": "<h1>The Long HTML Description</h1>",
    "is_hidden": false,
    "total_attendees": 200,
    "checkin_count": 105,
    "chapter": {
        "id": 2,
        "title": "Central City",
        "description": "Join our group!",
        "city": "San Francisco",
        "state": "CA",
        "country": "US",
        "timezone": "America/Los_Angeles",
        "url": "https://mypage.com/chapter/",
        "chapter_team": [
            {
            "id": 256, 
            "user": {
                "id": 2600, 
                "first_name": "John", 
                "last_name": "Smith",
                "email": "john.smith@example.com"
            }, 
            "title": "Group Leader",
            "role": {
                "id": 1, 
                "name": "Director",                     
                "description": "Full chapter permissions."
            }
            }
        ]
    }
} as const;

function loadEnv(): Result<ENV> {
    const { NODE_ENV, NOTION_API_KEY, NOTION_PAGE_ID } = process.env;
    if (NODE_ENV === undefined || NOTION_API_KEY === undefined || NOTION_PAGE_ID === undefined) {
        return new Failure();
    }

    return new Success({
        NODE_ENV,
        NOTION_API_KEY,
        NOTION_PAGE_ID,
    })
}

async function createDatabase(client: Client, pageId: string): Promise<Result<string>> {
    try {
        const database = await client.databases.create({
            parent: {
                type: "page_id",
                page_id: pageId,
            },
            title: [
                {
                    type: "text",
                    text: {
                        content: "GDSC Japan Events",
                    }
                }
            ],
            properties: {
                "Title": {
                    type: "title",
                    title: {},
                },
                "Date": {
                    type: "date",
                    date: {},
                },
                "Chapter": {
                    type: "rich_text",
                    rich_text: {},
                }
            }
        });
    
        return new Success(database.id);            
    } catch (error) {
        return new Failure(error);
    }
}

// this function should become http request handler if this project hosted as webhook reciever
async function fetchEventFromBevy(): Promise<Result<Event>> {
    // use example data provided by Bevy document
    const event: Event = {
        title: EXAMPLE_DATA.title,
        date: new Date(EXAMPLE_DATA.start_date),
        chapter: {
            name: EXAMPLE_DATA.chapter.title,
        }
    }
    return new Success(event);
}

async function addNewEvent(client: Client, databaseId: string, event: Event): Promise<Result> {
    try {
        const page = await client.pages.create({
            parent: {
                database_id: databaseId,
            },
            properties: {
                "Title": {
                    type: "title",
                    title: [{ type: "text", text: { content: event.title } }],
                },
                "Date": {
                    type: "date",
                    date: { start: event.date.toISOString() },
                },
                // TODO: use relation
                // Another table for chapters in notion should be good idea
                "Chapter": {
                    type: "rich_text",
                    rich_text: [{ type: "text", text: { content: event.chapter.name }}],
                }
            },
        })
        return new Success(page);
    } catch (error) {
        return new Failure(error);
    }
}

async function main(): Promise<void> {
    const result = loadEnv();
    if (result.isFailure) {
        console.error("Lack of required environment variables.");
        process.exit(1);
    }

    const { NODE_ENV, NOTION_API_KEY, NOTION_PAGE_ID } = result.value;
    console.log(`Environment: ${NODE_ENV}`);

    const notion = new Client({ auth: NOTION_API_KEY });
    const createDatabaseResult = await createDatabase(notion, NOTION_PAGE_ID);
    if (createDatabaseResult.isFailure) {
        console.error("Failed to create a new database.");
        console.error(createDatabaseResult.value);
        process.exit(1);
    }
    const databaseId = createDatabaseResult.value;

    const fetchEventResult = await fetchEventFromBevy();
    if (fetchEventResult.isFailure) {
        console.error("Failed to fetch an event from a bevy instance.");
        process.exit(1);
    }
    const event = fetchEventResult.value;

    const addNewEventResult = await addNewEvent(notion, databaseId, event);
    if (addNewEventResult.isFailure) {
        console.error("Failed to add a new page to database.");
        console.error(`Title: ${event.title}`);
        console.error(addNewEventResult.value);
    }
    
    console.log("Finish successfully.");
}

main();