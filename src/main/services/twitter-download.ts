import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { TwitterDownloadOptions as BaseTwitterDownloadOptions } from 'src/preload/types';
import type { TwitterUserData, TwitterMediaData } from '@shared/types/twitter-download';

interface TwitterDownloadOptions extends BaseTwitterDownloadOptions {
  onProgress?: (message: string) => void;
}

export async function downloadTwitterMedia(options: TwitterDownloadOptions): Promise<void> {
  const { username, cookies, downloadPath = './downloads', includeRetweets = false, onProgress } = options;

  // 从 Cookie 中提取 ct0 token
  const ct0Match = cookies.match(/ct0=([^;]+)/);
  const authToken = ct0Match ? ct0Match[1] : null;

  if (!authToken) {
    throw new Error('无法从 Cookie 中提取 ct0 token');
  }

  const bearerToken =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const baseURL = 'https://api.twitter.com';
  const headers = {
    authorization: `Bearer ${bearerToken}`,
    'x-csrf-token': authToken,
    cookie: cookies,
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
  };

  // 创建下载目录
  const userPath = path.join(downloadPath, username);
  const photosPath = path.join(userPath, '图片');
  const videosPath = path.join(userPath, '视频');

  await fs.promises.mkdir(photosPath, { recursive: true });
  await fs.promises.mkdir(videosPath, { recursive: true });

  onProgress?.(`✓ 创建下载目录: ${userPath}`);

  // 获取用户信息
  onProgress?.(`🔍 正在获取用户 @${username} 的信息...`);

  const variables = {
    screen_name: username,
    withSafetyModeUserFields: true,
  };

  const features = {
    hidden_profile_likes_enabled: false,
    hidden_profile_subscriptions_enabled: false,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(features),
  });

  const userResponse = await fetch(`${baseURL}/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?${params.toString()}`, {
    headers,
  });

  if (!userResponse.ok) {
    throw new Error(`获取用户信息失败: ${userResponse.status}`);
  }

  const userData: TwitterUserData = await userResponse.json();
  const user = userData.data.user.result;
  const userId = user.rest_id;

  onProgress?.(`✓ 找到用户: ${user.legacy.name} (@${user.legacy.screen_name})`);

  // 获取媒体推文
  onProgress?.('📥 正在获取媒体推文...');

  const mediaList: Array<{ type: string; url: string; filename: string }> = [];
  let cursor: string | null = null;
  let pageCount = 0;
  let emptyPageCount = 0; // 连续空媒体页面计数

  do {
    const tweetVariables: Record<string, unknown> = {
      userId,
      count: 20,
      includePromotedContent: false,
      withClientEventToken: false,
      withBirdwatchNotes: false,
      withVoice: true,
    };

    if (cursor) {
      tweetVariables.cursor = cursor;
    }

    const tweetFeatures = {
      rweb_video_screen_enabled: false,
      payments_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: false,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    };

    const fieldToggles = {
      withArticlePlainText: false,
    };

    const tweetParams = new URLSearchParams({
      variables: JSON.stringify(tweetVariables),
      features: JSON.stringify(tweetFeatures),
      fieldToggles: JSON.stringify(fieldToggles),
    });

    const response = await fetch(`${baseURL}/graphql/VwWNqXOyrgLzyzEx0d60jg/UserMedia?${tweetParams.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`获取媒体推文失败: ${response.status}`);
    }

    const data: TwitterMediaData = await response.json();

    pageCount++;
    const instructions = data.data.user.result.timeline.timeline.instructions;
    let mediaCount = 0;
    let hasNewCursor = false;

    // 提取媒体
    for (const instruction of instructions) {
      if (instruction.type === 'TimelineAddToModule') {
        const moduleItems = instruction.moduleItems || [];
        for (const item of moduleItems) {
          const tweetResult = item.item?.itemContent?.tweet_results?.result;
          if (tweetResult?.legacy) {
            const tweet = tweetResult.legacy;
            const isRetweet = tweet.retweeted_status_result || tweet.full_text?.startsWith('RT @');

            if (!includeRetweets && isRetweet) continue;

            if (tweet.extended_entities?.media) {
              for (const media of tweet.extended_entities.media) {
                if (media.type === 'photo') {
                  const url = media.media_url_https.replace(/\?.*$/, '') + '?name=orig';
                  mediaList.push({
                    type: 'photo',
                    url,
                    filename: `photo_${tweet.id_str}_${mediaCount}.jpg`,
                  });
                  mediaCount++;
                } else if (media.type === 'video' && media.video_info) {
                  const variants = media.video_info.variants
                    .filter((v: { content_type: string }) => v.content_type === 'video/mp4')
                    .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0));

                  if (variants.length > 0) {
                    mediaList.push({
                      type: 'video',
                      url: variants[0].url,
                      filename: `video_${tweet.id_str}_${mediaCount}.mp4`,
                    });
                    mediaCount++;
                  }
                } else if (media.type === 'animated_gif' && media.video_info) {
                  const variants = media.video_info.variants
                    .filter((v: { content_type: string }) => v.content_type === 'video/mp4')
                    .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0));

                  if (variants.length > 0) {
                    mediaList.push({
                      type: 'gif',
                      url: variants[0].url,
                      filename: `gif_${tweet.id_str}_${mediaCount}.mp4`,
                    });
                    mediaCount++;
                  }
                }
              }
            }
          }
        }
      } else if (instruction.type === 'TimelineAddEntries') {
        const entries = instruction.entries;
        for (const entry of entries) {
          if (entry.content.entryType === 'TimelineTimelineModule') {
            const items = entry.content.items;
            for (const item of items) {
              const tweetResult = item.item?.itemContent?.tweet_results?.result;
              if (tweetResult?.legacy) {
                const tweet = tweetResult.legacy;
                const isRetweet = tweet.retweeted_status_result || tweet.full_text?.startsWith('RT @');

                if (!includeRetweets && isRetweet) continue;

                if (tweet.extended_entities?.media) {
                  for (const media of tweet.extended_entities.media) {
                    if (media.type === 'photo') {
                      const url = media.media_url_https.replace(/\?.*$/, '') + '?name=orig';
                      mediaList.push({
                        type: 'photo',
                        url,
                        filename: `photo_${tweet.id_str}_${mediaCount}.jpg`,
                      });
                      mediaCount++;
                    } else if (media.type === 'video' && media.video_info) {
                      const variants = media.video_info.variants
                        .filter((v: { content_type: string }) => v.content_type === 'video/mp4')
                        .sort(
                          (a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0),
                        );

                      if (variants.length > 0) {
                        mediaList.push({
                          type: 'video',
                          url: variants[0].url,
                          filename: `video_${tweet.id_str}_${mediaCount}.mp4`,
                        });
                        mediaCount++;
                      }
                    } else if (media.type === 'animated_gif' && media.video_info) {
                      const variants = media.video_info.variants
                        .filter((v: { content_type: string }) => v.content_type === 'video/mp4')
                        .sort(
                          (a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0),
                        );

                      if (variants.length > 0) {
                        mediaList.push({
                          type: 'gif',
                          url: variants[0].url,
                          filename: `gif_${tweet.id_str}_${mediaCount}.mp4`,
                        });
                        mediaCount++;
                      }
                    }
                  }
                }
              }
            }
          } else if (entry.content.entryType === 'TimelineTimelineCursor') {
            cursor = entry.content.value;
            hasNewCursor = true;
          }
        }
      }
    }

    onProgress?.(`  第 ${pageCount} 页: ${mediaCount} 个媒体文件 (总计: ${mediaList.length})`);

    // 如果连续5页都没有新媒体，停止请求
    if (mediaCount === 0) {
      emptyPageCount++;
      if (emptyPageCount >= 5) {
        onProgress?.('  连续多页无新媒体，已到底部');
        break;
      }
    } else {
      emptyPageCount = 0; // 重置计数
    }

    // 如果没有新的 cursor，说明已经到底了
    if (!hasNewCursor) {
      break;
    }

    // 延迟避免速率限制
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } while (cursor);

  onProgress?.(`✓ 总共获取到 ${mediaList.length} 个媒体文件`);

  // 下载媒体
  let downloaded = 0;
  for (const media of mediaList) {
    try {
      const targetPath = media.type === 'photo' ? photosPath : videosPath;
      const filepath = path.join(targetPath, media.filename);

      if (fs.existsSync(filepath)) {
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(media.url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const writer = fs.createWriteStream(filepath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reader = Readable.fromWeb(response.body as any);
      reader.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      downloaded++;
      if (downloaded % 10 === 0) {
        onProgress?.(`进度: 已下载 ${downloaded}/${mediaList.length}`);
      }
    } catch (err) {
      const error = err as Error;
      onProgress?.(`下载失败: ${media.filename} - ${error.message}`);
    }
  }

  onProgress?.(`✓ 完成: 下载了 ${downloaded} 个文件`);
}
