import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n";
import { videoPattern, isURL, spotifyPattern } from "../utils/patterns";

import play, { SpotifyTrack, stream, video_basic_info } from "play-dl";
import { CommandInteraction, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { config } from "../utils/config";

export interface SongData {
  url: string;
  title: string;
  duration: number;
  thumbnail?: string;
  req?: RequesterData;
}

export interface RequesterData {
  tag: string;
  avatar: string;
  name: string;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public readonly thumbnail?: string;
  public readonly req?: RequesterData;

  public constructor({ url, title, duration, thumbnail, req }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
    this.thumbnail = thumbnail;
    this.req = req;
  }

  public static async from(
    url: string = "",
    search: string = "",
    interaction: CommandInteraction | ChatInputCommandInteraction
  ) {
    const isYoutubeUrl = videoPattern.test(url);
    const isSpotifyUrl = spotifyPattern.test(url);

    let songInfo;

    if (isYoutubeUrl) {
      songInfo = await video_basic_info(url);

      return new this({
        url: songInfo.video_details.url,
        title: songInfo.video_details.title!,
        duration: songInfo.video_details.durationInSec,
        thumbnail: songInfo.video_details.thumbnails[0].url,
        req: {
          tag: interaction.user.tag,
          avatar: interaction.user.displayAvatarURL(),
          name: interaction.user.displayName
        }
      });
    }

    if (isSpotifyUrl) {
      const spotifyInfo = (await play.spotify(url)) as SpotifyTrack;
      const spotifyTitle = spotifyInfo.name;
      const spotifyArtist = spotifyInfo.artists[0].name;

      const spotifyresult = await play.search(`${spotifyArtist} - ${spotifyTitle}`, { limit: 1 });
      songInfo = await video_basic_info(spotifyresult[0].url);

      return new this({
        title: songInfo.video_details.title as string,
        url: songInfo.video_details.url,
        duration: songInfo.video_details.durationInSec,
        thumbnail: songInfo.video_details.thumbnails[0].url,
        req: {
          tag: interaction.user.tag,
          avatar: interaction.user.displayAvatarURL(),
          name: interaction.user.displayName
        }
      });
    }

    const result = await youtube.searchOne(search);
    result ? null : console.log(`No results found for ${search}`);

    if (!result) {
      let err = new Error(`No search results found for ${search}`);
      err.name = "NoResults";
      if (isURL.test(url)) err.name = "InvalidURL";
      throw err;
    }

    songInfo = await video_basic_info(`https://youtube.com/watch?v=${result.id}`);

    return new this({
      url: songInfo.video_details.url,
      title: songInfo.video_details.title!,
      duration: songInfo.video_details.durationInSec,
      thumbnail: songInfo.video_details.thumbnails[0].url,
      req: {
        tag: interaction.user.tag,
        avatar: interaction.user.displayAvatarURL(),
        name: interaction.user.displayName
      }
    });
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    let playStream;

    playStream = await stream(this.url);

    if (!playStream.stream) return;

    return createAudioResource(playStream.stream, { metadata: this, inputType: playStream.type, inlineVolume: true });
  }

  public startMessage() {
    if (!this.thumbnail) {
      return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
    }

    const playingEmbed = new EmbedBuilder()
      .setColor("#000000")
      .setTitle(i18n.__("play.musicPlayerTitle"))
      .setURL(this.url)
      .setThumbnail((this.thumbnail as string) ? (this.thumbnail as string) : null)
      .setDescription(i18n.__mf("play.startedPlayingThumbnail", { title: this.title }))
      .setFooter({
        text: i18n.__mf("play.requestedBy", { name: this.req?.name }),
        iconURL: this.req?.avatar
      });

    return { embeds: [playingEmbed] };
  }
}
