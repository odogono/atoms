import { useRef, type FormEvent } from 'react';

export const APITester = () => {
  const responseInputRef = useRef<HTMLTextAreaElement>(null);

  const testEndpoint = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const endpoint = formData.get('endpoint') as string;
      const url = new URL(endpoint, location.href);
      const method = formData.get('method') as string;
      const res = await fetch(url, { method });

      const data = await res.json();
      responseInputRef.current!.value = JSON.stringify(data, null, 2);
    } catch (error) {
      responseInputRef.current!.value = String(error);
    }
  };

  return (
    <div className="api-tester">
      <form className="endpoint-row" onSubmit={testEndpoint}>
        <select className="method" name="method">
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
        </select>
        <input
          className="url-input"
          defaultValue="/api/hello"
          name="endpoint"
          placeholder="/api/hello"
          type="text"
        />
        <button className="send-button" type="submit">
          Send
        </button>
      </form>
      <textarea
        className="response-area"
        placeholder="Response will appear here..."
        readOnly
        ref={responseInputRef}
      />
    </div>
  );
};
