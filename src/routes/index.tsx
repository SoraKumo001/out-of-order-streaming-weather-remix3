import { type Handle } from "@remix-run/ui";
import { SSRFetch, useSSR } from "../provider/SSRProvider";
import { Link } from "../provider/RouterProvider";

interface Center {
  name: string;
  enName: string;
  officeName?: string;
  children?: string[];
  parent?: string;
  kana?: string;
}
interface Centers {
  [key: string]: Center;
}
interface Area {
  centers: Centers;
  offices: Centers;
  class10s: Centers;
  class15s: Centers;
  class20s: Centers;
}

export default function (_handle: Handle) {
  return () => (
    <div className="max-w-xl mx-auto my-8 p-6 bg-white rounded-lg shadow">
      <div>
        Please enable
        `chrome://flags/#enable-experimental-web-platform-features`
      </div>
      <h1 className="text-2xl font-bold mb-6 text-indigo-900 border-b pb-2">
        JS不要の順不同ストリーミング天気予報 (Remix 3){" "}
      </h1>
      <SSRFetch
        name="area-list"
        action={async () => {
          await new Promise((r) => setTimeout(r, 1000));
          return fetch(
            "https://www.jma.go.jp/bosai/common/const/area.json",
          ).then((v) => v.json());
        }}
      >
        <List />
      </SSRFetch>
    </div>
  );
}

function List(handle: Handle) {
  return () => {
    const { value, state } = useSSR<Area>(handle);
    return (
      <div>
        {state === "loading" && (
          <div className="text-gray-500 italic">エリアデータを取得中...</div>
        )}
        {value && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(value.offices).map(([code, { name }]) => (
              <div
                key={code}
                className="hover:bg-indigo-50 p-2 rounded transition"
              >
                <Link
                  to={`/weather/${code}`}
                  className="text-indigo-600 font-semibold hover:text-indigo-800"
                >
                  {name}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
}
