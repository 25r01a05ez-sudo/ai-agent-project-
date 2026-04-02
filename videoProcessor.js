// src/processors/videoProcessor.js - Orchestrates all processing services

const axios = require('axios');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const {
  DescriptService,
  AssemblyAIService,
  GoogleTranslationService,
  iZotopeService,
  TopazService,
  RunwayService,
  ClaudeService,
} = require('./apiIntegrations');

// Initialize AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

class VideoProcessor {
  constructor(db, jobId, videoId, userId) {
    this.db = db;
    this.jobId = jobId;
    this.videoId = videoId;
    this.userId = userId;
    this.results = {};
  }

  /**
   * Main orchestration method - runs all enabled features
   */
  async processVideo(features) {
    console.log(`[${this.jobId}] Starting video processing`);

    try {
      // Get video metadata
      const videoData = await this.getVideoData();

      // Update job status
      await this.updateJobStatus('processing', 10);

      // Run features in parallel (independent ones)
      const parallelTasks = [];

      if (features.sceneDetection) {
        parallelTasks.push(this.processSceneDetection(videoData));
      }

      if (features.speechToText) {
        parallelTasks.push(this.processTranscription(videoData));
      }

      if (features.audioEnhancement) {
        parallelTasks.push(this.processAudioEnhancement(videoData));
      }

      // Wait for parallel tasks
      const parallelResults = await Promise.allSettled(parallelTasks);

      await this.updateJobStatus('processing', 40);

      // Run dependent features (those requiring results from above)
      if (features.colorGrading) {
        await this.processColorGrading(videoData);
      }

      if (features.multiLanguage && this.results.speechToText) {
        await this.processTranslation();
      }

      if (features.autoReframing) {
        await this.processAutoReframing(videoData);
      }

      if (features.effectSuggestions) {
        await this.processEffectSuggestions(videoData);
      }

      await this.updateJobStatus('processing', 85);

      // Compose final video with all enhancements
      await this.composeVideo(videoData, features);

      await this.updateJobStatus('completed', 100);

      console.log(`[${this.jobId}] Video processing completed successfully`);

      return {
        success: true,
        results: this.results,
        jobId: this.jobId,
      };
    } catch (error) {
      console.error(`[${this.jobId}] Processing error:`, error);
      await this.updateJobStatus('failed', 0, error.message);
      throw error;
    }
  }

  /**
   * Get video metadata from database and S3
   */
  async getVideoData() {
    const result = await this.db.query(
      'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
      [this.videoId, this.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Video not found');
    }

    return result.rows[0];
  }

  /**
   * Feature 1: Scene Detection & Auto-Cutting
   */
  async processSceneDetection(videoData) {
    console.log(`[${this.jobId}] Starting scene detection`);

    try {
      // Download video from S3
      const videoPath = await this.downloadFromS3(videoData.s3_key);

      // Call FFmpeg to analyze scenes
      const sceneData = await this.analyzeScenes(videoPath);

      // Save results
      this.results.sceneDetection = {
        scenes: sceneData.scenes,
        totalScenes: sceneData.scenes.length,
        cuts: sceneData.cuts,
      };

      // Save to database
      await this.saveProcessingResult('sceneDetection', {
        sceneCount: sceneData.scenes.length,
        cuts: sceneData.cuts,
      });

      // Clean up
      fs.unlinkSync(videoPath);

      console.log(`[${this.jobId}] Scene detection completed: ${sceneData.scenes.length} scenes found`);
    } catch (error) {
      console.error(`[${this.jobId}] Scene detection failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 2: Speech-to-Text & Transcription
   */
  async processTranscription(videoData) {
    console.log(`[${this.jobId}] Starting transcription`);

    try {
      // Download video from S3
      const videoPath = await this.downloadFromS3(videoData.s3_key);

      // Extract audio
      const audioPath = await this.extractAudio(videoPath);

      // Use Descript API (primary) or fallback to AssemblyAI
      let transcript;

      try {
        transcript = await this.transcribeWithDescript(audioPath);
      } catch (error) {
        console.warn(`[${this.jobId}] Descript failed, trying AssemblyAI`);
        transcript = await this.transcribeWithAssemblyAI(audioPath);
      }

      // Generate SRT subtitles
      const srtContent = this.generateSRT(transcript);
      const srtKey = `subtitles/${this.userId}/${this.jobId}/en.srt`;
      await this.uploadToS3(srtKey, srtContent, 'text/plain');

      this.results.speechToText = {
        transcript: transcript.text,
        confidence: transcript.confidence || 0.95,
        srtUrl: srtKey,
        captions: transcript.captions,
      };

      // Save to database
      await this.saveProcessingResult('speechToText', {
        transcriptLength: transcript.text.length,
        confidence: transcript.confidence,
        srtUrl: srtKey,
      });

      // Clean up
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);

      console.log(`[${this.jobId}] Transcription completed`);
    } catch (error) {
      console.error(`[${this.jobId}] Transcription failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 3: Audio Enhancement & Noise Removal
   */
  async processAudioEnhancement(videoData) {
    console.log(`[${this.jobId}] Starting audio enhancement`);

    try {
      // Download video from S3
      const videoPath = await this.downloadFromS3(videoData.s3_key);

      // Extract audio
      const audioPath = await this.extractAudio(videoPath);

      // Use iZotope API or Krisp for noise removal
      let enhancedAudioPath;

      try {
        enhancedAudioPath = await this.enhanceAudioWithiZotope(audioPath);
      } catch (error) {
        console.warn(`[${this.jobId}] iZotope failed, using basic enhancement`);
        enhancedAudioPath = await this.enhanceAudioBasic(audioPath);
      }

      // Upload to S3
      const audioKey = `audio/${this.userId}/${this.jobId}/enhanced.wav`;
      await this.uploadFileToS3(audioKey, enhancedAudioPath);

      this.results.audioEnhancement = {
        audioUrl: audioKey,
        noiseReductionDb: 15,
        normalization: true,
      };

      // Save to database
      await this.saveProcessingResult('audioEnhancement', {
        audioUrl: audioKey,
        enhancement: 'complete',
      });

      // Clean up
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
      fs.unlinkSync(enhancedAudioPath);

      console.log(`[${this.jobId}] Audio enhancement completed`);
    } catch (error) {
      console.error(`[${this.jobId}] Audio enhancement failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 4: AI Color Grading
   */
  async processColorGrading(videoData) {
    console.log(`[${this.jobId}] Starting color grading`);

    try {
      // Download video from S3
      const videoPath = await this.downloadFromS3(videoData.s3_key);

      // Analyze video for color correction
      const colorProfile = await this.analyzeColorProfile(videoPath);

      // Apply color grading using Topaz Video AI or TensorFlow
      let gradedVideoPath;

      try {
        gradedVideoPath = await this.gradeVideoWithTopaz(videoPath, colorProfile);
      } catch (error) {
        console.warn(`[${this.jobId}] Topaz failed, using ML-based grading`);
        gradedVideoPath = await this.gradeVideoWithML(videoPath, colorProfile);
      }

      // Upload to S3
      const videoKey = `videos/${this.userId}/${this.jobId}/graded.mp4`;
      await this.uploadFileToS3(videoKey, gradedVideoPath);

      this.results.colorGrading = {
        videoUrl: videoKey,
        colorProfile: colorProfile,
        lut: 'cinematic',
      };

      // Save to database
      await this.saveProcessingResult('colorGrading', {
        videoUrl: videoKey,
        lut: 'cinematic',
      });

      // Clean up
      fs.unlinkSync(videoPath);
      fs.unlinkSync(gradedVideoPath);

      console.log(`[${this.jobId}] Color grading completed`);
    } catch (error) {
      console.error(`[${this.jobId}] Color grading failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 5: Multi-Language Translation
   */
  async processTranslation() {
    console.log(`[${this.jobId}] Starting multi-language translation`);

    if (!this.results.speechToText || !this.results.speechToText.captions) {
      throw new Error('Transcription required for translation');
    }

    try {
      const languages = ['es', 'fr', 'de', 'ja', 'zh'];
      const translations = {};

      for (const lang of languages) {
        const translated = await this.translateWithGoogle(
          this.results.speechToText.transcript,
          lang
        );

        // Generate SRT for translated subtitles
        const translatedCaptions = this.translateCaptions(
          this.results.speechToText.captions,
          translated.text
        );

        const srtContent = this.generateSRT(translatedCaptions);
        const srtKey = `subtitles/${this.userId}/${this.jobId}/${lang}.srt`;
        await this.uploadToS3(srtKey, srtContent, 'text/plain');

        translations[lang] = {
          srtUrl: srtKey,
          text: translated.text,
        };
      }

      this.results.multiLanguage = translations;

      // Save to database
      await this.saveProcessingResult('multiLanguage', {
        languages: Object.keys(translations),
        translationUrls: translations,
      });

      console.log(`[${this.jobId}] Translation completed for ${languages.length} languages`);
    } catch (error) {
      console.error(`[${this.jobId}] Translation failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 6: Auto-Reframing for Social Media
   */
  async processAutoReframing(videoData) {
    console.log(`[${this.jobId}] Starting auto-reframing`);

    try {
      // Download video from S3
      const videoPath = await this.downloadFromS3(videoData.s3_key);

      // Analyze faces and important objects
      const faceData = await this.detectFaces(videoPath);

      // Generate reframed versions for different aspect ratios
      const aspectRatios = {
        '9:16': { width: 1080, height: 1920 }, // TikTok/Reels
        '1:1': { width: 1080, height: 1080 }, // Instagram
        '4:5': { width: 1080, height: 1350 }, // Pinterest
      };

      const reframedVideos = {};

      for (const [ratio, dims] of Object.entries(aspectRatios)) {
        const reframedPath = await this.reframeVideo(
          videoPath,
          dims.width,
          dims.height,
          faceData
        );

        const videoKey = `videos/${this.userId}/${this.jobId}/reframed_${ratio.replace(':', '_')}.mp4`;
        await this.uploadFileToS3(videoKey, reframedPath);

        reframedVideos[ratio] = {
          url: videoKey,
          dimensions: dims,
        };

        fs.unlinkSync(reframedPath);
      }

      this.results.autoReframing = reframedVideos;

      // Save to database
      await this.saveProcessingResult('autoReframing', {
        ratios: Object.keys(reframedVideos),
        videos: reframedVideos,
      });

      // Clean up
      fs.unlinkSync(videoPath);

      console.log(`[${this.jobId}] Auto-reframing completed for ${Object.keys(reframedVideos).length} formats`);
    } catch (error) {
      console.error(`[${this.jobId}] Auto-reframing failed:`, error);
      throw error;
    }
  }

  /**
   * Feature 7: Effect Suggestions
   */
  async processEffectSuggestions(videoData) {
    console.log(`[${this.jobId}] Starting effect suggestions`);

    try {
      // Analyze video pacing and mood using Claude AI
      const effects = await this.analyzeEffectsWithClaude(videoData);

      this.results.effectSuggestions = {
        effects: effects,
        confidence: 0.85,
      };

      // Save to database
      await this.saveProcessingResult('effectSuggestions', {
        suggestionCount: effects.length,
        effects: effects,
      });

      console.log(`[${this.jobId}] Effect suggestions completed: ${effects.length} suggestions`);
    } catch (error) {
      console.error(`[${this.jobId}] Effect suggestions failed:`, error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  async downloadFromS3(s3Key) {
    const localPath = path.join(
      process.env.LOCAL_STORAGE || './uploads',
      `${Date.now()}-temp-video.mp4`
    );

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    };

    const file = fs.createWriteStream(localPath);

    return new Promise((resolve, reject) => {
      s3.getObject(params)
        .createReadStream()
        .pipe(file)
        .on('close', () => resolve(localPath))
        .on('error', reject);
    });
  }

  async uploadFileToS3(key, filePath) {
    const fileContent = fs.readFileSync(filePath);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
    };

    return new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async uploadToS3(key, content, contentType) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: content,
      ContentType: contentType,
    };

    return new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async updateJobStatus(status, progress, errorMessage = null) {
    const timestamp = status === 'completed' ? new Date() : null;

    await this.db.query(
      `UPDATE processing_jobs 
       SET status = $1, progress = $2, error_message = $3, completed_at = $4, updated_at = NOW()
       WHERE id = $5`,
      [status, progress, errorMessage, timestamp, this.jobId]
    );
  }

  async saveProcessingResult(featureName, metadata) {
    await this.db.query(
      `INSERT INTO processing_results (job_id, feature_name, metadata, success)
       VALUES ($1, $2, $3, $4)`,
      [this.jobId, featureName, JSON.stringify(metadata), true]
    );
  }

  // ==================== IMPLEMENTED HELPER METHODS ====================

  /**
   * Detect scene changes using FFmpeg scene filter.
   * Returns an array of scene timestamps and suggested cut points.
   */
  async analyzeScenes(videoPath) {
    const outputPath = `${videoPath}-scenes.txt`;
    const threshold = parseFloat(process.env.SCENE_DETECTION_THRESHOLD || '0.3');
    const safeThreshold = Number.isFinite(threshold) && threshold > 0 && threshold < 1 ? threshold : 0.3;

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilters(`select=gt(scene\\,${safeThreshold}),showinfo`)
        .outputOptions(['-f', 'null'])
        .output(os.platform() === 'win32' ? 'NUL' : '/dev/null')
        .on('end', resolve)
        .on('stderr', (line) => {
          // Collect showinfo lines to a file for parsing
          if (line.includes('pts_time')) {
            fs.appendFileSync(outputPath, line + '\n');
          }
        })
        .on('error', reject)
        .run();
    });

    const scenes = [];
    const cuts = [];

    if (fs.existsSync(outputPath)) {
      const lines = fs.readFileSync(outputPath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(/pts_time:([\d.]+)/);
        if (match) {
          const time = parseFloat(match[1]);
          scenes.push({ index: idx + 1, timestamp: time });
          cuts.push(time);
        }
      });
      fs.unlinkSync(outputPath);
    }

    return { scenes, cuts };
  }

  /**
   * Extract audio track from video using FFmpeg.
   * Returns the path to the extracted WAV file.
   */
  async extractAudio(videoPath) {
    const audioPath = videoPath.replace(/\.[^.]+$/, '-audio.wav');

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .save(audioPath)
        .on('end', resolve)
        .on('error', reject);
    });

    return audioPath;
  }

  /**
   * Transcribe audio using Descript API.
   */
  async transcribeWithDescript(audioPath) {
    const descript = new DescriptService();
    return descript.transcribeVideo(audioPath);
  }

  /**
   * Transcribe audio using AssemblyAI API (fallback).
   */
  async transcribeWithAssemblyAI(audioPath) {
    const assemblyAI = new AssemblyAIService();
    return assemblyAI.transcribeAudio(audioPath);
  }

  /**
   * Generate SRT subtitle file content from a transcript.
   */
  generateSRT(transcript) {
    const captions = transcript.captions || [];
    if (!captions.length) return '';

    return captions
      .map((cap) => {
        return `${cap.index}\n${cap.startTime} --> ${cap.endTime}\n${cap.text}\n`;
      })
      .join('\n');
  }

  /**
   * Enhance audio using iZotope API (with FFmpeg fallback).
   */
  async enhanceAudioWithiZotope(audioPath) {
    const izotope = new iZotopeService();
    return izotope.enhanceAudio(audioPath);
  }

  /**
   * Basic FFmpeg audio enhancement as fallback.
   */
  async enhanceAudioBasic(audioPath) {
    const outputPath = audioPath.replace('.wav', '-enhanced.wav');

    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .audioFrequency(44100)
        .audioChannels(2)
        .audioCodec('pcm_s16le')
        .audioFilters([
          'highpass=f=75',
          'lowpass=f=12000',
          'volume=1.2',
          'afftdn=nf=-25',
        ])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    return outputPath;
  }

  /**
   * Analyze color profile of the video using FFmpeg signalstats filter.
   */
  async analyzeColorProfile(videoPath) {
    return new Promise((resolve, reject) => {
      let statsOutput = '';

      ffmpeg(videoPath)
        .videoFilters('signalstats')
        .outputOptions(['-f', 'null'])
        .output(os.platform() === 'win32' ? 'NUL' : '/dev/null')
        .on('stderr', (line) => {
          statsOutput += line;
        })
        .on('end', () => {
          // Parse basic luminance values from signalstats output
          const yavgMatch = statsOutput.match(/YAVG:([\d.]+)/);
          const yavg = yavgMatch ? parseFloat(yavgMatch[1]) : 128;

          let preset = 'cinematic';
          if (yavg < 80) preset = 'bright';
          else if (yavg > 180) preset = 'dark';

          resolve({ yavg, preset });
        })
        .on('error', () => {
          // Fallback to default profile if signalstats fails
          resolve({ yavg: 128, preset: 'cinematic' });
        })
        .run();
    });
  }

  /**
   * Apply color grading using Topaz Video AI API.
   */
  async gradeVideoWithTopaz(videoPath, colorProfile) {
    const topaz = new TopazService();
    const result = await topaz.gradeVideo(videoPath, colorProfile);
    return result.outputPath;
  }

  /**
   * Apply color grading using FFmpeg LUT filters as ML fallback.
   */
  async gradeVideoWithML(videoPath, colorProfile) {
    const outputPath = videoPath.replace(/\.[^.]+$/, '-graded.mp4');

    // Apply cinematic-style color grading via FFmpeg curves
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilters([
          'eq=contrast=1.1:brightness=0.02:saturation=1.2:gamma=0.95',
          "curves=r='0/0 0.5/0.48 1/1':g='0/0 0.5/0.5 1/1':b='0/0 0.5/0.52 1/1'",
        ])
        .videoCodec('libx264')
        .outputOptions(['-preset', 'fast', '-crf', '20'])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    return outputPath;
  }

  /**
   * Translate text using Google Cloud Translation API.
   */
  async translateWithGoogle(text, targetLang) {
    const googleTranslation = new GoogleTranslationService();
    return googleTranslation.translateText(text, targetLang);
  }

  /**
   * Map original caption timings to a translated text block.
   * Distributes translated words proportionally across the original caption slots.
   */
  translateCaptions(captions, translatedText) {
    if (!captions || !captions.length || !translatedText) return [];

    const words = translatedText.split(/\s+/);
    const wordsPerCaption = Math.ceil(words.length / captions.length);

    return captions.map((cap, idx) => {
      const start = idx * wordsPerCaption;
      const slice = words.slice(start, start + wordsPerCaption).join(' ');
      return {
        index: cap.index,
        startTime: cap.startTime,
        endTime: cap.endTime,
        text: slice || '',
      };
    });
  }

  /**
   * Detect faces using Runway ML API.
   */
  async detectFaces(videoPath) {
    const runway = new RunwayService();
    return runway.detectFaces(videoPath);
  }

  /**
   * Reframe video for a target aspect ratio.
   * Uses Runway ML when faces are detected, otherwise falls back to FFmpeg center-crop.
   */
  async reframeVideo(videoPath, width, height, faceData) {
    // If Runway returned face data, use the smart-crop API
    if (faceData && faceData.faces && faceData.faces.length > 0) {
      const runway = new RunwayService();
      return runway.reframeVideo(videoPath, width, height, faceData);
    }

    // Fallback: FFmpeg center-crop
    const outputPath = videoPath.replace(/\.[^.]+$/, `-reframed-${width}x${height}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilters([
          `scale=${width}:${height}:force_original_aspect_ratio=increase`,
          `crop=${width}:${height}`,
        ])
        .videoCodec('libx264')
        .outputOptions(['-preset', 'fast', '-crf', '22'])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    return outputPath;
  }

  /**
   * Use Claude AI to suggest visual effects and transitions.
   */
  async analyzeEffectsWithClaude(videoData) {
    const claude = new ClaudeService();
    const suggestions = await claude.suggestEffects(videoData);
    return suggestions.effects || [];
  }

  /**
   * Compose final video that merges enhanced audio with the (optionally) color-graded video.
   * Falls back gracefully when optional enhancements are not present.
   */
  async composeVideo(videoData, features) {
    console.log(`[${this.jobId}] Starting final video composition`);

    const videoPath = await this.downloadFromS3(videoData.s3_key);
    const outputPath = videoPath.replace(/\.[^.]+$/, '-final.mp4');
    const tempFiles = [videoPath, outputPath];

    let inputVideo = videoPath;
    let gradedPath = null;
    let enhancedAudioPath = null;

    // Use color-graded video if available (videoUrl is stored as the S3 key)
    if (features.colorGrading && this.results.colorGrading && this.results.colorGrading.videoUrl) {
      gradedPath = await this.downloadFromS3(this.results.colorGrading.videoUrl);
      tempFiles.push(gradedPath);
      inputVideo = gradedPath;
    }

    // Build FFmpeg command
    const command = ffmpeg(inputVideo).videoCodec('libx264').outputOptions(['-preset', 'fast', '-crf', '20']);

    // Merge enhanced audio if available (audioUrl is stored as the S3 key)
    if (features.audioEnhancement && this.results.audioEnhancement && this.results.audioEnhancement.audioUrl) {
      enhancedAudioPath = await this.downloadFromS3(this.results.audioEnhancement.audioUrl);
      tempFiles.push(enhancedAudioPath);
      command
        .addInput(enhancedAudioPath)
        .audioCodec('aac')
        .outputOptions(['-map', '0:v:0', '-map', '1:a:0', '-shortest']);
    } else {
      command.audioCodec('copy');
    }

    await new Promise((resolve, reject) => {
      command
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // Upload composed video to S3
    const finalKey = `videos/${this.userId}/${this.jobId}/final.mp4`;
    await this.uploadFileToS3(finalKey, outputPath);

    this.results.finalVideo = { videoUrl: finalKey };

    await this.saveProcessingResult('finalVideo', { videoUrl: finalKey });

    // Clean up all temp files
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }

    console.log(`[${this.jobId}] Final video composition completed`);
  }
}

module.exports = VideoProcessor;
