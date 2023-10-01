import { Playlist as youtubePlaylist, Thumbnail, Video, YouTube as youtube } from "youtube-sr";
import { config } from "../utils/config";
import { Song } from "./Song";
import { ChatInputCommandInteraction, CommandInteraction } from "discord.js";
import { fetch } from "undici";
import play from "play-dl";

const SpotifyUrlInfo = require("spotify-url-info");

export class Playlist {
  public readonly data: youtubePlaylist;
  public readonly videos: Song[];

  public constructor({
    playlist,
    interaction
  }: {
    playlist: youtubePlaylist;
    interaction: CommandInteraction | ChatInputCommandInteraction;
  }) {
    this.data = playlist;
    this.videos = this.data.videos
      .filter((video: Video) => video.title != "Private video" && video.title != "Deleted video")
      .slice(0, config.MAX_PLAYLIST_SIZE)
      .map(
        (video: Video): Song =>
          new Song({
            title: video?.title as string,
            url: video.url,
            duration: video.duration / 1000,
            thumbnail: (video.thumbnail as Thumbnail).url as string,
            req: {
              tag: interaction.user.tag,
              avatar: interaction.user.displayAvatarURL(),
              name: interaction.user.displayName
            }
          })
      );
  }

  public static async from(
    url: string = "",
    search: string = "",
    interaction: CommandInteraction | ChatInputCommandInteraction
  ): Promise<Playlist> {
    const isYoutubeUrl = play.yt_validate(url) === "playlist";
    const isSpotifyUrl = play.sp_validate(url) === "playlist" || play.sp_validate(url) === "album";

    let playlist: youtubePlaylist;
    if (isSpotifyUrl) {
      const playlistDetails = await SpotifyUrlInfo(fetch).getDetails(url);
      const playlistTrack = playlistDetails.tracks;

      if (playlistTrack.length > config.MAX_PLAYLIST_SIZE) {
        playlistTrack.length = config.MAX_PLAYLIST_SIZE;
      }

      const spotifyPl = Promise.all(
        playlistTrack.map(async (track: any): Promise<Video> => {
          return await youtube.searchOne(`${track.name} - ${track.artists ? track.artists[0].name : ""}`, "video");
        })
      );
      playlist = new youtubePlaylist({
        videos: await Promise.all(
          (await spotifyPl).filter((song: Video): boolean => song.title != undefined || song.duration != undefined)
        )
      });
      playlist.title = playlistDetails.preview.title || "Playlist";
    } else if (isYoutubeUrl) {
      playlist = await youtube.getPlaylist(url);
    } else {
      const result = await play.search(search, {
        source: {
          youtube: "playlist"
        },
        limit: 1
      });
      playlist = await youtube.getPlaylist(result[0].url as string);
    }

    return new this({ playlist, interaction });
  }
}
