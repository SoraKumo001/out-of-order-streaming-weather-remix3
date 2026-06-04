import { type Handle } from "remix/ui";
import { SSRFetch, useSSR } from "../provider/SSRProvider";
import { Link, useParams } from "../provider/RouterProvider";

interface Weather {
  publishingOffice: string;
  reportDatetime: Date;
  targetArea: string;
  headlineText: string;
  text: string;
}

export default function (handle: Handle) {
  return () => {
    const { id } = useParams(handle);
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-lg shadow">
        <SSRFetch
          name={`weather-${id}`}
          action={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return fetch(
              `https://www.jma.go.jp/bosai/forecast/data/overview_forecast/${id}.json`,
            ).then((v) => v.json());
          }}
        >
          <WeatherItem />
        </SSRFetch>
      </div>
    );
  };
}

function WeatherItem(handle: Handle) {
  return () => {
    const { value, state } = useSSR<Weather>(handle);
    return (
      <div>
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← 戻る
          </Link>
        </div>
        {state === "loading" && (
          <div className="text-gray-500 italic">天気予報を取得中...</div>
        )}
        {value && (
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-950 mb-2">
              {value.targetArea} の天気概況
            </h1>
            <div className="text-sm text-gray-400 mb-6">
              発表官署: {value.publishingOffice} | 発表日時:{" "}
              {new Date(value.reportDatetime).toLocaleString("ja-JP")}
            </div>
            {value.headlineText && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r">
                <p className="font-semibold text-yellow-800">
                  {value.headlineText}
                </p>
              </div>
            )}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                {value.text}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };
}
