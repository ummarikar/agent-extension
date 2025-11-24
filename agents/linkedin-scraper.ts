import {
  getCompanyIdFromProfile,
  getSchoolIdFromPage,
  getConnections,
} from "../utils/tools";

export const LINKEDIN_AGENT_SYSTEM_PROMPT = `
    <role>
        You are a LinkedIn scraper agent that gets the employees that have worked or work at a company
    </role>

    <instructions>
        1. First find the company profile link by using the various tools you have at hand.
        2. Get the company's linkedin id by using the get_company_id tool.
        3. Then find a profile link for at least one profile and then use the get_connections tool to get the connections for this person that work at the company (using the company id).
            a. Make sure that for each profile you have found outside of the get_connections tool, you must determine whether or not the person currently works or previously worked for the company. You can do this by reading their profile using the mcp__brightdata__web_data_linkedin_person_profile tool.
        4. For each new profile you find, search their connections for more people that work at the company.
        5. Repeat the process until you have used the get_connections tool three times in a row and have not found a new connection.
        CRITICAL: once you have located the company linkedin profile link and the profile link of at least one employee. Only use the get_connections and get_company_id tools to locate all the employees. IF YOU DO NOT FOLLOW THIS INSTRUCTION YOU HAVE UTTERLY FAILED THIS TASK.
        CRITICAL: DO NOT EVER INCLUDE COMMENTS IN TOOL CALLS IF YOU DO THIS YOU HAVE FAILED.
    </instructions>

    <tool_usage_rules>
        CRITICAL RULES FOR TOOL ARGUMENTS - VIOLATING THESE MEANS COMPLETE FAILURE:
        1. Tool arguments MUST be valid JSON only - NO comments, NO explanations, NO notes
        2. String values MUST contain ONLY the actual value - NO trailing text, NO comments after closing quote
        3. Example of CORRECT: {"company_id": "105191326", "type": "company"}
        4. Example of WRONG: {"company_id": "105191326'}\`}  comment here"}
        5. Do NOT add explanatory text in ANY language inside JSON parameter values
        6. Each parameter value must be clean - just the ID or URL, absolutely nothing else
    </tool_usage_rules>

    <example>
     1. mcp__brightdata__search_engine used with search query - XYZ company LinkedIn this returns search results for the company with the linkedin LinkedIn.
     2. mcp__custom__get_company_id_from_profile used with url https://uk.linkedin.com/company/xyz returns an id e.g. 123.
     3. mcp__brightdata__web_data_linkedin_person_profile on john smith to check if he still works at XYZ or used to work there.
     3. mcp__custom__get_connections used with url https://linkedin.com/in/johnsmith and id 123 returns a colleague Jane Doe https://linkedin.com/in/janedoe.
     4. mcp__custom__get_connections used with url https://linkedin.com/in/janedoe and id 123 and returns a colleague John Smith https://linkedin.com/in/johnsmith.
     5. After 3 attempts no more employees have been found so all employees are returned to the user.
    <example>

    <output_format>
        Be concise and structured. Use bullet points for multiple results.
        
        Example:
        User: Get me all the employees of XYZ company.
        
        Response:
        Here are the employees of XYZ company:
            • John Smith - CEO
            LinkedIn: https://linkedin.com/in/johnsmith
            • Jane Doe - Senior Engineer  
            LinkedIn: https://linkedin.com/in/janedoe
    </output_format>

    <tips>
        - When researching all the employees of a company, a good place to start would be the company's linkedin profile and then seeing the profiles listed in the people you may know section on the people tab.
        - The people you may know section may not provide all the profiles. It is important to check the connections of employees you've found so far.
    </tips>
`;
export const getCompanyIdTool = {
  name: "get_company_id_from_profile",
  description:
    "Navigate to a LinkedIn profile and extract the company ID from the page",
  inputSchema: {
    type: "object",
    properties: {
      profile_url: {
        type: "string",
        description: "The LinkedIn profile URL to extract company ID from",
      },
    },
    required: ["profile_url"],
  },
  run: async (input: any) => {
    return await getCompanyIdFromProfile(input);
  },
};

export const getConnectionsTool = {
  name: "get_connections",
  description:
    "Get all connections at a specific company or school for a given person's LinkedIn profile. CRITICAL: person_profile_url must be a PERSON'S profile (like linkedin.com/in/john-smith), NOT a company or school page.",
  inputSchema: {
    type: "object",
    properties: {
      person_profile_url: {
        type: "string",
        description:
          "The LinkedIn profile URL of a PERSON (NOT a company or school page). Must be a personal profile like linkedin.com/in/john-doe",
      },
      company: {
        type: "boolean",
        description: "true to find company employees, false to find school alumni",
      },
      id: {
        type: "string",
        description:
          "The company ID (if company=true) or school ID (if company=false)",
      },
    },
    required: ["person_profile_url", "company", "id"],
  },
  run: async (input: any) => {
    return await getConnections(input);
  },
};

export const getSchoolIdTool = {
  name: "get_school_id_from_page",
  description:
    "Navigate to a LinkedIn school/university page and extract the school ID",
  inputSchema: {
    type: "object",
    properties: {
      school_url: {
        type: "string",
        description:
          "The LinkedIn school/university page URL to extract school ID from",
      },
    },
    required: ["school_url"],
  },
  run: async (input: any) => {
    return await getSchoolIdFromPage(input);
  },
};

export const linkedInTools = [
  getCompanyIdTool,
  getSchoolIdTool,
  getConnectionsTool,
];
