// 用户数据响应
export interface TwitterUserData {
  data: {
    user: {
      result: {
        rest_id: string;
        legacy: {
          name: string;
          screen_name: string;
        };
      };
    };
  };
}

// 推文遗留数据
interface TweetLegacy {
  id_str: string;
  full_text?: string;
  retweeted_status_result?: unknown;
  extended_entities?: {
    media: Array<{
      type: string;
      media_url_https: string;
      video_info?: {
        variants: Array<{
          content_type: string;
          url: string;
          bitrate?: number;
        }>;
      };
    }>;
  };
}

// 推文结果类型 - 标准推文
interface StandardTweet {
  __typename?: 'Tweet';
  legacy?: TweetLegacy;
}

// 推文结果类型 - 带可见性限制的推文
interface TweetWithVisibilityResults {
  __typename: 'TweetWithVisibilityResults';
  tweet: StandardTweet;
}

export type TweetResult = StandardTweet | TweetWithVisibilityResults;

// 时间线项
interface TimelineItem {
  item?: {
    itemContent?: {
      tweet_results?: {
        result?: TweetResult;
      };
    };
  };
}

// 时间线指令
type TimelineInstruction =
  | {
      type: 'TimelineAddToModule';
      moduleItems: TimelineItem[];
    }
  | {
      type: 'TimelineAddEntries';
      entries: Array<
        | {
            entryId: string;
            content: {
              entryType: 'TimelineTimelineModule';
              items: TimelineItem[];
            };
          }
        | {
            entryId: string;
            content: {
              entryType: 'TimelineTimelineCursor';
              value: string;
              cursorType: string;
            };
          }
      >;
    };

// 媒体数据响应
export interface TwitterMediaData {
  data: {
    user: {
      result: {
        timeline: {
          timeline: {
            instructions: TimelineInstruction[];
          };
        };
      };
    };
  };
}
